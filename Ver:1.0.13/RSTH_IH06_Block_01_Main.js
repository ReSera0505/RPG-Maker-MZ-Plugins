/*:
 * @target MZ
 * @plugindesc RSTH_IH: サバイバルゲームシステムプラグイン
 * @author ReSera_りせら
 *
 * ▼ ライセンス
 * このプラグインは MITライセンス の下で公開されています。
 */

(() => {

    "use strict";

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    //const RSTH_DEBUG_LOG = true;
    const RSTH_DEBUG_LOG = false;

    //=============================================================================================================
    // ブロックの設置、破壊、更新などの処理===========================================================================
    //=============================================================================================================
    //「壊せる・設置できる」ブロックの見た目を制御するスプライトクラス。
    window.RSTH_IH.Sprite_SurvivalBlock = class extends Sprite {

        constructor(block) {
            super();
            const item = $dataItems[block.itemId];
            if (!item || !item.meta) {
                if (RSTH_DEBUG_LOG) console.error("[Sprite_SurvivalBlock] $dataItems 未初期化 or item.meta 不正", block.itemId, $dataItems);
                return; // クラッシュ防止
            }
            const tilesetName = item?.meta?.tileset || window.RSTH_IH.TILESET_NAME;
            const cfg = window.RSTH_IH.getTilesetConfigByName(tilesetName);
            const tileSize = cfg.tileSize;
            const cols = cfg.cols;

            this.bitmap = ImageManager.loadTileset(tilesetName);
            this.x = block.x * $gameMap.tileWidth();
            this.y = block.y * $gameMap.tileHeight();

            const col = (block.tileId - 1) % cols;
            const row = Math.floor((block.tileId - 1) / cols);
            this.setFrame(col * tileSize, row * tileSize, tileSize, tileSize);

            this.z = 5;
            this.block = block;
            if (RSTH_DEBUG_LOG) console.log("[RSTH] tilesetName:", tilesetName);

        }

        updatePosition() {
            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            this.x = Math.round(this.block.x * tw - $gameMap.displayX() * tw);
            this.y = Math.round(this.block.y * th - $gameMap.displayY() * th);
        }

        update() {
            super.update();
            this.updatePosition();
        }
    }



    // 設置ブロックのスプライト管理や描画処理を担当。
    window.RSTH_IH.SurvivalBlockManager = {
        _blocks: [],
        _sprites: [],
        _spriteAddQueue: [],
        _spriteRefreshQueue: [],
        _blockMap: new Map(),

        rebuildBlockMap() {
            this._blockMap = new Map();
            for (const block of this._blocks) {
                const key = `${block.x},${block.y}`;
                if (!this._blockMap.has(key)) {
                    this._blockMap.set(key, []);
                }
                this._blockMap.get(key).push(block);
            }
        }
        ,

        place(x, y, itemId) {
            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][place] START x=${x} y=${y}`);
            const item = $dataItems[itemId];

            if (!item || !item.meta || !item.meta.tileOffsets1) return;

            let tileOffsets = item._tileOffsets1Parsed || [];

            const newBlockType = window.RSTH_IH.ItemTypeCache[itemId].blockType;

            for (const offset of tileOffsets) {
                const px = x + (offset.dx || 0);
                const py = y + (offset.dy || 0);

                if (px < 0 || py < 0 || px >= $gameMap.width() || py >= $gameMap.height()) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] 座標(${px}, ${py})はマップ外です。設置をスキップします。`);
                    continue;
                }

                const tileId = Number(offset.tileId || 0);
                const passable = !!offset.passable;

                // ★ 既存ブロックとの重ね置きチェックを許可付きで行う
                const existingBlocks = this.getAll(px, py);
                const cannotStack = existingBlocks.some(existing => {
                    const type = window.RSTH_IH.ItemTypeCache[existing.itemId].blockType;
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]type`, type);
                    if (type === "ground" &&
                        (newBlockType === "floor" ||
                            newBlockType === "wall" ||
                            newBlockType === "furniture" ||
                            newBlockType === "chest" ||
                            newBlockType === "workbench" ||
                            newBlockType === "plant")
                    ) return false;
                    if (type === "floor" &&
                        (newBlockType === "wall" ||
                            newBlockType === "furniture" ||
                            newBlockType === "chest" ||
                            newBlockType === "workbench" ||
                            newBlockType === "plant")
                    ) return false;
                    return true;
                });

                if (cannotStack) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] (${px}, ${py})には重ね置き不可のブロックが既に存在します`);
                    continue;
                }

                const isGrowBlock = newBlockType === window.RSTH_IH.GrowBlock;
                if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]isGrowBlock`, isGrowBlock);

                if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("[SurvivalBlockManager][place]_1");
                const block = {
                    x: px,
                    y: py,
                    tileId: tileId,
                    itemId: itemId,
                    blockHP: Number(item.meta.blockHP || 0),
                    passable: passable,
                    originX: x,
                    originY: y,
                    growthStage: 0,         // 成長段階を初期化
                    growthTime: isGrowBlock ? Number(item.meta.growthTime || 0) : 0, // ← ここを条件付きに
                    _growthApplied: false,   // スプライト適用済みフラグを初期化
                    _isGrowthRoot: false,
                    originalOffsets: tileOffsets,
                    blockType: window.RSTH_IH.ItemTypeCache[itemId].blockType,
                    tileType: window.RSTH_IH.ItemTypeCache[itemId].tileType,
                    bitmask: 0,
                    shape: 0
                };


                if (RSTH_DEBUG_LOG) console.log("[SurvivalBlockManager][place]item.meta.growthTime", item.meta.growthTime);
                if (RSTH_DEBUG_LOG) console.log("[SurvivalBlockManager][place]block", block);
                // マップシーン中なら即スプライト追加
                this._blocks.push(block);

                // 🔧 修正：配列として登録
                const key = `${block.x},${block.y}`;
                if (!this._blockMap.has(key)) {
                    this._blockMap.set(key, []);
                }
                this._blockMap.get(key).push(block);


                window.RSTH_IH.getBlocks_and_Spriteslist("[SurvivalBlockManager][place]_2");
                if (SceneManager._scene instanceof Scene_Map) {
                    this.addSprite(block);
                }

                // セーブ用に保存
                $gameSystem._survivalBlocks = $gameSystem._survivalBlocks || [];
                $gameSystem._survivalBlocks.push(block);



            }

            // ▼ オートタイル結合時、隣接スプライトも即時再描画（上下左右）※安全対応
            if (item.meta.autoTile === "true") {
                const thisType = window.RSTH_IH.ItemTypeCache[itemId].blockType;
                const thistileType = window.RSTH_IH.ItemTypeCache[itemId].tileType;

                window.RSTH_IH.getBlocks_and_Spriteslist("[SurvivalBlockManager][place]thisType ", thisType);
                window.RSTH_IH.getBlocks_and_Spriteslist("[SurvivalBlockManager][place]thistileType ", thistileType);

                const cx = x;
                const cy = y;

                const neighborOffsets = [
                    [-1, -1], [0, -1], [1, -1],
                    [1, 0], [1, 1], [0, 1],
                    [-1, 1], [-1, 0]
                ];

                // （neighborOffsetsは変更せず使用）

                for (const [dx, dy] of neighborOffsets) {
                    const nx = cx + dx;
                    const ny = cy + dy;

                    const neighbor = this.get(nx, ny);
                    const neighborItem = neighbor ? $dataItems[neighbor.itemId] : null;
                    const neighborTileType = neighbor ? window.RSTH_IH.ItemTypeCache[neighbor.itemId].tileType : 0;

                    if (neighbor && neighborItem?.meta?.autoTile === "true" &&
                        window.RSTH_IH.ItemTypeCache[neighbor.itemId].blockType === thisType &&
                        neighborTileType === thistileType) {

                        this._spriteRefreshQueue.push({ x: nx, y: ny });

                        // キャッシュ更新処理を AutotileShapeBitmaskCache.data に変更
                        const cacheKey = `${neighbor.originX ?? nx},${neighbor.originY ?? ny},${thisType},${thistileType}`;
                        const bitmask = window.RSTH_IH.calculateAutotileBitmask(nx, ny, thisType, thistileType);
                        const shape = (thistileType === 1)
                            ? (window.RSTH_IH.WallAutotileBitmaskToShape.get(bitmask) ?? 15)
                            : (window.RSTH_IH.FloorAutotileBitmaskToShape.get(bitmask) ?? 46);
                        window.RSTH_IH.AutotileShapeBitmaskCache.data[cacheKey] = shape;
                    }
                }

                // 自分自身も必ずリフレッシュ＋キャッシュ更新
                this._spriteRefreshQueue.push({ x: cx, y: cy });

                const selfCacheKey = `${x},${y},${thisType},${thistileType}`;
                const selfBitmask = window.RSTH_IH.calculateAutotileBitmask(x, y, thisType, thistileType);
                const selfShape = (thistileType === 1)
                    ? (window.RSTH_IH.WallAutotileBitmaskToShape.get(selfBitmask) ?? 15)
                    : (window.RSTH_IH.FloorAutotileBitmaskToShape.get(selfBitmask) ?? 46);
                window.RSTH_IH.AutotileShapeBitmaskCache.data[selfCacheKey] = selfShape;

            }



            if (RSTH_DEBUG_LOG) console.log("[SurvivalBlockManager][place]this._spriteRefreshQueue", this._spriteRefreshQueue);
            if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("[SurvivalBlockManager][place]完了");

        }
        ,

        break(x, y) {
            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][break] START x=${x} y=${y}`);

            // 同じ座標にあるすべてのブロックを取得（後ろが上にある）
            const targets = this._blocks.filter(b => b.x === x && b.y === y);
            if (targets.length === 0) return;

            // 一番上のブロックを破壊対象とする（最後に追加されたものが上）
            const target = targets[targets.length - 1];

            if (RSTH_DEBUG_LOG) console.table("[break(x, y)] targets=", targets, "targets.length=", targets.length);
            if (RSTH_DEBUG_LOG) console.table("[break(x, y)] target=", target);

            const originX = target.originX ?? target.x;
            const originY = target.originY ?? target.y;
            const originBlockType = target.blockType ?? "ground";
            const originBlock = this._blocks.find(b => b.blockType === originBlockType && b.originX === originX && b.originY === originY);
            const isGrown = originBlock?.growthStage === 1;

            // ブロックHP初期化（メモ欄に<blockHP:10>がある場合）
            const item = $dataItems[originBlock?.itemId];
            const baseHP = Number(item?.meta?.blockHP || 1);
            originBlock.hp = originBlock.hp ?? baseHP;

            // ツールの攻撃力を取得（プレイヤーのホットバースロットから）
            // そもそもこのbreak()の処理を呼び出すにはtoolでブロックを左クリックしている状態なのでtypeチェックは不要
            const tool = window.RSTH_IH.getCurrentTool();
            const power = Number(tool?.meta?.toolPower || 0);

            originBlock.hp -= power;
            if (RSTH_DEBUG_LOG) console.warn(`[break] ${item?.name} のHPに ${power} ダメージ → 残HP: ${originBlock.hp}`);

            if (originBlock.hp > 0) {
                return; // まだ破壊しない
            }

            // ----- 以下、HP0以下で破壊する処理 -----

            // ドロップ処理
            if (item) {
                try {
                    const dropMeta = isGrown ? item.meta.dropItems2 : item.meta.dropItems1;
                    if (dropMeta) {
                        const entries = dropMeta.split(",");
                        const dropInfo = {};
                        for (const entry of entries) {
                            const [key, value] = entry.split(":").map(s => s.trim());
                            if (key && value) dropInfo[key] = value;
                        }

                        const dropId = Number(dropInfo.itemId);
                        const dropAmount = Math.max(1, Number(dropInfo.amount || 1));
                        if ($dataItems[dropId]) {
                            for (let i = 0; i < dropAmount; i++) {
                                window.RSTH_IH.DropManager.dropItemSmart(originX, originY, $dataItems[dropId]);
                            }
                        }
                    }
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][break] ドロップ解析失敗`, e);
                }
            }

            if (RSTH_DEBUG_LOG) console.table("[break(x, y)] originBlock=", originBlock);
            // 該当する origin からの構成ブロックすべて削除
            const toRemove = this._blocks.filter(b => b.blockType === originBlockType && b.originX === originX && b.originY === originY);
            for (const block of toRemove) {
                // _blocks から削除
                const ix = this._blocks.indexOf(block);
                if (ix >= 0) this._blocks.splice(ix, 1);

                // _blockMap から削除
                const key = `${block.x},${block.y}`;
                const list = this._blockMap.get(key);
                if (list) {
                    const idx = list.indexOf(block);
                    if (idx >= 0) list.splice(idx, 1);
                    if (list.length === 0) this._blockMap.delete(key);
                }

                // スプライト削除
                this.removeSpriteAt(block.x, block.y, block.itemId);
            }

            if (RSTH_DEBUG_LOG) console.table("[break(x, y)] toRemove=", toRemove);

            // 成長タイマー削除
            if (Array.isArray($gameSystem._growingTimers)) {
                $gameSystem._growingTimers = $gameSystem._growingTimers.filter(timer =>
                    !(timer.x === originX && timer.y === originY)
                );
            }

            // 成長状態の初期化
            if (originBlock) {
                originBlock.growthStage = 0;
                originBlock.growthTime = 0;
                originBlock._growthApplied = false;
            }

            // チェストブロックだった場合、中身をすべてドロップ
            if (originBlock.blockType === "chest") {
                const scene = SceneManager._scene;
                const chest = window.RSTH_IH.ChestManager.getChestAt(originX, originY);
                if (chest && Array.isArray(chest.items)) {
                    for (const item of chest.items) {
                        if (!item) continue;
                        window.RSTH_IH.DropManager.dropItemSmart(originX, originY, item);
                    }

                    // チェストデータも削除
                    window.RSTH_IH.ChestManager.removeChestAt(originX, originY);
                    if (RSTH_DEBUG_LOG) console.log(`[break] チェスト (${originX}, ${originY}) を削除し、中身をドロップ`);

                }

                if (scene._chestWindow.visible) {
                    //カーソルをホットバーのインデックスへ
                    if (scene._hotbarWindow && window.RSTH_IH.HobarSlotsIndex != null) {
                        if (window.RSTH_IH.HobarSlotsIndex === -1) window.RSTH_IH.HobarSlotsIndex = 0;
                        scene.updateCursorForSlot(window.RSTH_IH.HobarSlotsIndex, scene._hotbarWindow);
                    }
                    scene._chestWindow.hide();
                    scene._chestWindow.deactivate();
                }
            }

            const autoTileBlock = $dataItems[originBlock.itemId];
            if (RSTH_DEBUG_LOG) console.table("[break(x, y)] originBlock", originBlock);
            if (RSTH_DEBUG_LOG) console.table("[break(x, y)] autoTileBlock", autoTileBlock);


            if (autoTileBlock.meta.autoTile === "true") {
                const thisType = autoTileBlock.meta.blockType;
                const thistileType = Number(autoTileBlock.meta.tileType);
                const cx = x;
                const cy = y;

                const neighborOffsets = [
                    [-1, -1], [0, -1], [1, -1],
                    [1, 0], [1, 1], [0, 1],
                    [-1, 1], [-1, 0]
                ];

                for (const [dx, dy] of neighborOffsets) {
                    const nx = cx + dx;
                    const ny = cy + dy;

                    const neighbor = this.get(nx, ny);
                    const neighborItem = neighbor ? $dataItems[neighbor.itemId] : null;
                    const neighborTileType = neighbor ? Number(neighborItem?.meta?.tileType || 0) : 0;

                    if (neighbor && neighborItem?.meta?.autoTile === "true" &&
                        neighborItem.meta.blockType === thisType &&
                        neighborTileType === thistileType) {

                        // キャッシュ更新処理を追加
                        const bitmask = window.RSTH_IH.calculateAutotileBitmask(nx, ny, thisType, thistileType);
                        const shape = (thistileType === 1)
                            ? (window.RSTH_IH.WallAutotileBitmaskToShape.get(bitmask) ?? 15)
                            : (window.RSTH_IH.FloorAutotileBitmaskToShape.get(bitmask) ?? 46);

                        // 更新
                        const cacheKey = `${nx},${ny},${thisType},${thistileType}`;
                        window.RSTH_IH.AutotileShapeBitmaskCache.data[cacheKey] = shape;

                        // スプライト再描画予約
                        this._spriteRefreshQueue.push({ x: nx, y: ny });
                    }
                }

                // 自分自身も更新
                const selfBitmask = window.RSTH_IH.calculateAutotileBitmask(cx, cy, thisType, thistileType);
                const selfShape = (thistileType === 1)
                    ? (window.RSTH_IH.WallAutotileBitmaskToShape.get(selfBitmask) ?? 15)
                    : (window.RSTH_IH.FloorAutotileBitmaskToShape.get(selfBitmask) ?? 46);

                const selfCacheKey = `${cx},${cy},${thisType},${thistileType}`;
                window.RSTH_IH.AutotileShapeBitmaskCache.data[selfCacheKey] = selfShape;

                this._spriteRefreshQueue.push({ x: cx, y: cy });
            }



        }


        ,


        getAll(x, y) {
            const key = `${x},${y}`;
            return this._blockMap.get(key) || [];
        }

        ,


        get(x, y) {
            const key = `${x},${y}`;
            const list = this._blockMap.get(key);
            return list ? list[list.length - 1] : null;
        }
        ,


        addSprite(block, force = false) {
            this.addSpriteAt(block.x, block.y, force);
        }
        ,


        addSpriteAt(x, y, force = false) {
            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][addSpriteAt] START x=${x} y=${y}`);
            const blocks = this.getAll(x, y);
            if (!blocks || blocks.length === 0) return;

            const playerdistance = 40;
            // プレイヤーから遠すぎる場合はスキップ
            if (!force) {
                const px = $gamePlayer.x;
                const py = $gamePlayer.y;
                if (Math.abs(x - px) > playerdistance || Math.abs(y - py) > playerdistance) {
                    if (RSTH_DEBUG_LOG) console.log(`[addSpriteAt] 範囲外スキップ (${x}, ${y})`);
                    return;
                }
                if (RSTH_DEBUG_LOG) console.log(`[addSpriteAt] 範囲内続行 (${x}, ${y})`);
            }

            // blockType優先度定義
            const typePriority = {
                ground: 1,
                floor: 2,
                wall: 3,
                furniture: 4,
                chest: 4,
                workbench: 4,
                plant: 4,
                over: 5
            };

            // 優先度順でソート
            blocks.sort((a, b) => {
                const typeA = window.RSTH_IH.ItemTypeCache[a.itemId].blockType;
                const typeB = window.RSTH_IH.ItemTypeCache[b.itemId].blockType;
                return (typePriority[typeA] || 99) - (typePriority[typeB] || 99);
            });

            const spriteset = SceneManager._scene?._spriteset;
            if (!spriteset || !spriteset._tilemap) return;


            for (const block of blocks) {
                const item = $dataItems[block.itemId];
                if (!item || !item.meta) continue;

                const tilesetName = window.RSTH_IH.ItemTypeCache[block.itemId].tileset;
                if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][addSpriteAt]tilesetName`, tilesetName);
                const cfg = window.RSTH_IH.getTilesetConfigByName(tilesetName);
                if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][addSpriteAt]cfg `, cfg);
                const tileSize = cfg.tileSize;
                const cols = cfg.cols;

                let dx = 0, dy = 0;
                let blockZ = "over";
                let tileOffsets = [];

                try {
                    const tileOffsetsRaw = block.growthStage === 1
                        ? item._tileOffsets2Parsed
                        : item._tileOffsets1Parsed;

                    tileOffsets = Array.isArray(tileOffsetsRaw) ? tileOffsetsRaw : [];
                    const offset = tileOffsets.find(o => block.x === block.originX + o.dx && block.y === block.originY + o.dy);
                    if (offset) {
                        dx = Number(offset.dx || 0);
                        dy = Number(offset.dy || 0);
                        blockZ = offset.blockZ || "over";
                    }
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn("[addSpriteAt] tileOffsets parse error", e);
                }

                block.dx = dx;
                block.dy = dy;

                let sprite;
                // すでにスプライトが存在するか確認（block単位でキャッシュ化）
                sprite = this._sprites.find(s =>
                    s.block?.x === block.x &&
                    s.block?.y === block.y &&
                    s.block?.itemId === block.itemId
                );

                if (!sprite) {
                    if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][addSpriteAt]!sprite`);

                    if (item.meta.autoTile === "true") {
                        sprite = new window.RSTH_IH.Sprite_AutotileBlock(block);
                    } else {
                        sprite = new window.RSTH_IH.Sprite_SurvivalBlock(block);
                        sprite.bitmap = ImageManager.loadTileset(tilesetName);
                        const id = block.tileId - 1;
                        const col = id % cols;
                        const row = Math.floor(id / cols);
                        sprite.setFrame(col * tileSize, row * tileSize, tileSize, tileSize);
                    }
                    sprite.block = block;
                    sprite._growthApplied = block._growthApplied === true;
                    spriteset._tilemap.addChild(sprite);
                    this._sprites.push(sprite);
                }


                // z設定
                if (blockZ === "under") {
                    const blockType = window.RSTH_IH.ItemTypeCache[block.itemId].blockType;
                    switch (blockType) {
                        case "ground": sprite.z = 1; break;
                        case "floor": sprite.z = 2; break;
                        case "wall": sprite.z = 3; break;
                        case "furniture":
                        case "plant":
                        case "chest":
                        case "workbench":
                            sprite.z = 4; break;
                        default: sprite.z = 2; break;
                    }
                } else if (blockZ === "over") {
                    sprite.z = 5;
                } else {
                    sprite.z = 2;
                }

                // 既存の同じスプライトがあれば削除（完全一致のみ）
                const existing = this._sprites.find(s =>
                    s.block?.x === block.x &&
                    s.block?.y === block.y &&
                    s.block?.itemId === block.itemId &&
                    s.z === sprite.z
                );
                if (existing) {
                    spriteset._tilemap.removeChild(existing);
                    this._sprites.splice(this._sprites.indexOf(existing), 1);
                }

                sprite.anchor.x = 0;
                sprite.anchor.y = 0;
                sprite.x = Math.round(block.x * $gameMap.tileWidth() - $gameMap.displayX() * $gameMap.tileWidth());
                sprite.y = Math.round(block.y * $gameMap.tileHeight() - $gameMap.displayY() * $gameMap.tileHeight());

                sprite.block = block;
                sprite._growthApplied = block._growthApplied === true;

                spriteset._tilemap.addChild(sprite);
                this._sprites.push(sprite);
            }


        }
        ,




        updateGrowthSprites() {
            const blocksToAdd = [];
            const positionsToRemove = new Set();

            for (const sprite of [...this._sprites]) {
                const oldBlock = sprite.block;
                if (RSTH_DEBUG_LOG) console.table("[updateGrowthSprites]oldBlock_sprite.block", oldBlock);
                if (!oldBlock) continue;

                // 成長タイマーを減算し、0でgrowthStage=1にする
                if (typeof oldBlock.growthTime === "number" && oldBlock.growthTime > 0) {
                    oldBlock.growthTime--;
                    if (oldBlock.growthTime <= 0) {
                        oldBlock.growthStage = 1;
                    }
                }


                const updatedBlock = oldBlock;
                if (RSTH_DEBUG_LOG) console.table("[updateGrowthSprites]updatedBlock", updatedBlock);
                if (!updatedBlock || updatedBlock._growthApplied) continue;

                const item = $dataItems[updatedBlock.itemId];
                if (!item) continue;

                if (updatedBlock.growthStage === 1) {
                    try {
                        const tileOffsets2 = item._tileOffsets2Parsed || [];
                        if (!Array.isArray(tileOffsets2) || tileOffsets2.length === 0) continue;
                        if (RSTH_DEBUG_LOG) console.table(tileOffsets2);

                        // 古い位置を除去対象に登録
                        for (const offset of tileOffsets2) {
                            const tx = updatedBlock.x + (offset.dx || 0);
                            const ty = updatedBlock.y + (offset.dy || 0);
                            positionsToRemove.add(`${tx},${ty}`);
                        }

                        // 中心ブロックに特別フラグを付ける
                        updatedBlock._growthApplied = true;
                        updatedBlock._isGrowthRoot = true;
                        sprite._growthApplied = true;

                        // originX/Y は oldBlock からコピー（復元確実）
                        const originX = oldBlock.originX ?? oldBlock.x;
                        const originY = oldBlock.originY ?? oldBlock.y;

                        // 追加用ブロック生成
                        for (const offset of tileOffsets2) {
                            const bx = updatedBlock.x + (offset.dx || 0);
                            const by = updatedBlock.y + (offset.dy || 0);

                            const isRoot = (offset.dx === 0 && offset.dy === 0);

                            const existing = this.get(bx, by);
                            const existingItem = existing ? $dataItems[existing.itemId] : null;
                            const existingType = existingItem?.meta?.blockType;

                            // groundが存在する場合、growthブロックに置き換えない
                            if (existingType === "ground") {
                                if (RSTH_DEBUG_LOG) console.warn(`[updateGrowthSprites] (${bx},${by}) は ground ブロックなので growth ブロックを配置しません`);
                                continue;
                            }
                            if (RSTH_DEBUG_LOG) console.warn(`[updateGrowthSprites]updatedBlock`, updatedBlock);

                            const newBlock = {
                                x: bx,
                                y: by,
                                tileId: Number(offset.tileId),
                                itemId: updatedBlock.itemId,
                                blockHP: Number(updatedBlock.blockHP || 0),
                                passable: offset.hasOwnProperty("passable") ? !!offset.passable : true,
                                originX,
                                originY,
                                growthStage: 1,
                                _growthApplied: true,
                                _isGrowthRoot: isRoot,
                                originalOffsets: tileOffsets2,
                                blockType: window.RSTH_IH.ItemTypeCache[updatedBlock.itemId].blockType,
                                tileType: window.RSTH_IH.ItemTypeCache[updatedBlock.itemId].tileType,
                                bitmask: 0,
                                shape: 0
                            };
                            if (RSTH_DEBUG_LOG) console.warn(`[updateGrowthSprites]newBlock`, newBlock);
                            blocksToAdd.push(newBlock);
                            if (RSTH_DEBUG_LOG) console.log("[SurvivalBlockManager][updateGrowthSprites]newBlock", newBlock);
                        }

                    } catch (e) {
                        if (RSTH_DEBUG_LOG) console.warn("[updateGrowthSprites] tileOffsets2 parse error", e);
                    }
                }

            }

            // 古いブロック削除（blockTypeがwindow.RSTH_IH.GrowBlockのもののみ削除）
            this._blocks = this._blocks.filter(b => {
                const item = $dataItems[b.itemId];
                const type = item?.meta?.blockType || "";
                const key = `${b.x},${b.y}`;
                return !(type === window.RSTH_IH.GrowBlock && positionsToRemove.has(key));
            });
            // 🔽 追加：_blockMap からも GrowBlock を削除
            for (const key of positionsToRemove) {
                const list = this._blockMap.get(key);
                if (Array.isArray(list)) {
                    const filtered = list.filter(block => {
                        const item = $dataItems[block.itemId];
                        const type = item?.meta?.blockType || "";
                        return type !== window.RSTH_IH.GrowBlock;
                    });
                    if (filtered.length > 0) {
                        this._blockMap.set(key, filtered);
                    } else {
                        this._blockMap.delete(key);
                    }
                }
            }

            // 古いスプライト削除（blockTypeがwindow.RSTH_IH.GrowBlockのもののみ削除）
            this._sprites = this._sprites.filter(sprite => {
                const block = sprite.block;
                const bx = block?.x;
                const by = block?.y;
                const key = `${bx},${by}`;
                const item = $dataItems[block?.itemId];
                const type = item?.meta?.blockType || "";

                if (type === window.RSTH_IH.GrowBlock && positionsToRemove.has(key)) {
                    if (sprite.parent && typeof sprite.parent.removeChild === "function") {
                        sprite.parent.removeChild(sprite);
                    }
                    return false;
                }
                return true;
            });

            if (RSTH_DEBUG_LOG) console.warn("[updateGrowthSprites]this._blocks = ", this._blocks, "this._sprites = ", this._sprites);

            // 新しいブロックを登録
            for (const block of blocksToAdd) {
                this._blocks.push(block);
                const key = `${block.x},${block.y}`;
                if (!this._blockMap.has(key)) {
                    this._blockMap.set(key, []);
                }
                this._blockMap.get(key).push(block);
                this.addSprite(block);
            }


            // ★強制リフレッシュ：スプライト＋マップ表示を完全更新
            if (SceneManager._scene && SceneManager._scene._spriteset) {
                const tilemap = SceneManager._scene._spriteset._tilemap;
                if (tilemap && typeof tilemap.refresh === "function") {
                    tilemap.refresh();  // 描画ズレを防止
                }
            }

        }
        ,

        removeSpriteAt(x, y, itemId = null) {
            window.RSTH_IH.getBlocks_and_Spriteslist("removeSpriteAt_start");

            const spriteset = SceneManager._scene?._spriteset;
            if (!spriteset || !spriteset._tilemap) {
                if (RSTH_DEBUG_LOG) console.warn("[removeSpriteAt] spriteset または tilemap が null");
                return;
            }

            const remainSprites = [];

            for (const sprite of this._sprites) {
                const block = sprite.block;
                if (!block) {
                    remainSprites.push(sprite);
                    continue;
                }

                // 座標が一致しない → 残す
                if (block.x !== x || block.y !== y) {
                    remainSprites.push(sprite);
                    continue;
                }

                // itemId指定があり、不一致なら残す
                if (itemId !== null && block.itemId !== itemId) {
                    remainSprites.push(sprite);
                    continue;
                }

                // 削除対象
                spriteset._tilemap.removeChild(sprite);
                if (RSTH_DEBUG_LOG) {
                    console.log(`[removeSpriteAt] スプライト削除: (${x}, ${y})${itemId !== null ? ` itemId: ${itemId}` : ""}`);
                }
            }

            // スプライトリスト更新
            this._sprites = remainSprites;

            window.RSTH_IH.getBlocks_and_Spriteslist("removeSpriteAt_end");
        }


        ,

        // ★追加：セーブデータ読み込み後にスプライトを再構築する関数
        rebuildAllSprites() {
            this._sprites = [];
            if (!this._container) return;

            for (const block of this._blocks) {
                this.addSprite(block);
            }

            if (RSTH_DEBUG_LOG) console.log("[rebuildAllSprites] スプライト再構築完了", this._sprites);
        }
        ,

        // すべてのブロックスプライトを削除
        clear() {
            this._blocks = [];
            this._sprites.forEach(sprite => {
                const spriteset = SceneManager._scene._spriteset;
                if (spriteset && spriteset._tilemap && sprite) {
                    spriteset._tilemap.removeChild(sprite);
                }
            });
            this._sprites = [];
        }
        ,

        processSpriteAddQueue() {
            if (RSTH_DEBUG_LOG) console.log("[processSpriteAddQueue]start");
            const limit = 60;
            let count = 0;
            while (this._spriteAddQueue.length > 0 && count < limit) {
                const { block, chunkKey } = this._spriteAddQueue.shift();
                this.addSprite(block, true);
                // チャンクプールに登録
                this._chunkSpritePool ||= new Map();
                if (!this._chunkSpritePool.has(chunkKey)) {
                    this._chunkSpritePool.set(chunkKey, []);
                }
                this._chunkSpritePool.get(chunkKey).push(block);
                count++;
            }
        }

        ,

        refreshNearbySprites(px, py) {
            if (RSTH_DEBUG_LOG) console.log("[refreshNearbySprites]start");
            const chunkSize = 10;
            const chunkRange = 3;
            const skipRange = 2;

            this._loadedChunks ||= new Set();
            this._spriteAddQueue ||= [];
            this._chunkSpritePool ||= new Map();
            this._visibleChunks ||= new Set();

            const cx = Math.floor(px / chunkSize);
            const cy = Math.floor(py / chunkSize);

            if (this._lastChunkX === cx && this._lastChunkY === cy) {
                return;
            }
            this._lastChunkX = cx;
            this._lastChunkY = cy;

            for (let dx = -chunkRange; dx <= chunkRange; dx++) {
                for (let dy = -chunkRange; dy <= chunkRange; dy++) {
                    if (Math.abs(dx) <= skipRange && Math.abs(dy) <= skipRange) continue;

                    const chunkX = cx + dx;
                    const chunkY = cy + dy;
                    const chunkKey = `${chunkX},${chunkY}`;

                    if (this._loadedChunks.has(chunkKey)) continue;

                    const startX = chunkX * chunkSize;
                    const startY = chunkY * chunkSize;
                    const endX = startX + chunkSize;
                    const endY = startY + chunkSize;

                    const blocksInChunk = this._blocks.filter(block =>
                        block.x >= startX && block.x < endX &&
                        block.y >= startY && block.y < endY
                    );

                    if (blocksInChunk.length > 0) {
                        for (const block of blocksInChunk) {
                            this._spriteAddQueue.push({ block, chunkKey });
                        }
                        this._loadedChunks.add(chunkKey);
                        this._visibleChunks.add(chunkKey);  // 🔧 新規読み込み時に visible登録
                        if (RSTH_DEBUG_LOG) console.log(`[refreshNearbySprites] チャンク (${chunkX}, ${chunkY}) 読込`);
                    }
                }
            }
        }

        ,

        update(px, py) {
            this.refreshNearbySprites(px, py); // プレイヤーに近づいたらチャンクを検出してキューへ
            this.processSpriteAddQueue(); // 毎フレーム少しずつ描画
            this.cleanupFarChunks(px, py);

        }
        ,



        cleanupFarChunks(px, py) {
            if (RSTH_DEBUG_LOG) console.log(`[cleanupFarChunks] start`);
            const chunkSize = 10;
            const maxChunkDistance = 3;
            const currentChunkX = Math.floor(px / chunkSize);
            const currentChunkY = Math.floor(py / chunkSize);

            this._chunkSpritePool ||= new Map();
            this._visibleChunks ||= new Set();

            for (const chunkKey of this._chunkSpritePool.keys()) {
                const [chunkX, chunkY] = chunkKey.split(',').map(Number);
                const dx = Math.abs(chunkX - currentChunkX);
                const dy = Math.abs(chunkY - currentChunkY);


                const isVisible = dx <= maxChunkDistance && dy <= maxChunkDistance;

                // すでに非表示なら処理をスキップ
                if (!isVisible && !this._visibleChunks.has(chunkKey)) {
                    continue;
                }

                const sprites = this._sprites.filter(s =>
                    s.block &&
                    Math.floor(s.block.x / chunkSize) === chunkX &&
                    Math.floor(s.block.y / chunkSize) === chunkY
                );

                for (const sprite of sprites) {
                    sprite.visible = isVisible;
                }

                if (isVisible) {
                    this._visibleChunks.add(chunkKey);
                } else {
                    this._visibleChunks.delete(chunkKey);
                    if (RSTH_DEBUG_LOG) console.log(`[cleanupFarChunks] チャンク (${chunkX}, ${chunkY}) を非表示`);
                }
            }
        }
        ,

        updateSpriteRefreshQueue() {
            if (RSTH_DEBUG_LOG) console.log(`[updateSpriteRefreshQueue] start`);
            while (this._spriteRefreshQueue.length > 0) {
                const { x, y } = this._spriteRefreshQueue.shift();

                const blocks = this.getAll(x, y);  // 複数取得に対応
                if (RSTH_DEBUG_LOG) console.log("→ 再描画: ", x, y, blocks);

                if (blocks && blocks.length > 0) {
                    // まず既存のスプライトを全削除
                    this.removeSpriteAt(x, y);

                    // 重ね置き順にすべて再描画
                    for (const block of blocks) {
                        this.addSprite(block);
                    }
                }
            }
        }


    };

    window.RSTH_IH.SurvivalBlockManager.breakWithDrop = function (x, y, dropItemData) {
        this.break(x, y);
        if (dropItemData) {
            window.RSTH_IH.DropManager.dropItem(x, y, dropItemData);
        }
    };

})();