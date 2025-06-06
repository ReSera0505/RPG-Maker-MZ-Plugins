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
            const item = $dataItems[itemId];

            if (!item || !item.meta || !item.meta.tileOffsets1) return;

            let tileOffsets = [];
            try {
                tileOffsets = item._tileOffsets1Parsed || [];
            } catch (e) {
                if (RSTH_DEBUG_LOG) console.log("[SurvivalBlockManager][place] tileOffsets parse error:", e);
                return;
            }


            const newBlockType = item.meta.blockType || "unknown";

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
                    const type = $dataItems[existing.itemId]?.meta?.blockType || "unknown";
                    if (type === "ground" && (newBlockType === "floor" || newBlockType === "wall" || newBlockType === "furniture" || newBlockType === "plant")) return false;
                    if (type === "floor" && (newBlockType === "wall" || newBlockType === "furniture" || newBlockType === "plant")) return false;
                    return true;
                });

                if (cannotStack) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] (${px}, ${py})には重ね置き不可のブロックが既に存在します`);
                    continue;
                }

                const isGrowBlock = newBlockType === window.RSTH_IH.GrowBlock;
                if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]isGrowBlock`, isGrowBlock);

                window.RSTH_IH.getBlocks_and_Spriteslist("[SurvivalBlockManager][place]_1");
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
                    blockType: item.meta.blockType || window.RSTH_IH.GrowBlock
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
                const thisType = item.meta.blockType;
                const cx = x;
                const cy = y;

                const directions = [
                    { dx: 0, dy: -1 },
                    { dx: 0, dy: 1 },
                    { dx: -1, dy: 0 },
                    { dx: 1, dy: 0 }
                ];

                for (const d of directions) {
                    const nx = cx + d.dx;
                    const ny = cy + d.dy;

                    const neighbor = this.get(nx, ny);
                    const neighborItem = neighbor ? $dataItems[neighbor.itemId] : null;

                    if (neighbor && neighborItem?.meta?.autoTile === "true" && neighborItem.meta.blockType === thisType) {
                        this._spriteRefreshQueue.push({ x: nx, y: ny });
                        //console.warn("[place] spriteRefresh予約:", nx, ny);

                    }
                }
            }


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
                                //window.RSTH_IH.DropManager.dropItem(originX, originY, $dataItems[dropId]);
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

        // ブロック用スプライト追加 ここでアイテムのメタタグのtileOffsetsを読み込んで処理
        addSprite(block, force = false) {
            if (RSTH_DEBUG_LOG) console.warn("[addSprite] start");
            const item = $dataItems[block.itemId];
            if (!item || !item.meta) {
                if (RSTH_DEBUG_LOG) console.error("[addSprite] $dataItems 未初期化 or item.meta 不正", block.itemId, $dataItems);
                if (RSTH_DEBUG_LOG) console.groupEnd();
                return;
            }

            const rangeX = 30;
            const rangeY = 30;
            const px = $gamePlayer.x;
            const py = $gamePlayer.y;
            if (!force) {
                if (Math.abs(block.x - px) > rangeX || Math.abs(block.y - py) > rangeY) {
                    if (RSTH_DEBUG_LOG) console.log(`[addSprite] 範囲外スキップ (${block.x}, ${block.y})`);
                    return; // スプライトは生成しない
                }
            }

            const tilesetName = item?.meta?.tileset || window.RSTH_IH.TILESET_NAME;
            const cfg = window.RSTH_IH.getTilesetConfigByName(tilesetName);
            const tileSize = cfg.tileSize;
            const cols = cfg.cols;

            const sprite = new window.RSTH_IH.Sprite_SurvivalBlock(block);
            sprite.bitmap = ImageManager.loadTileset(tilesetName);

            let dx = 0, dy = 0;
            let blockZ = "over";  // デフォルト
            let targetTileId = block.tileId;

            // ▼ オートタイル補正（growthStage 0 限定）
            if (item.meta.autoTile === "true") {
                const cx = block.originX;
                const cy = block.originY;
                const thisType = item.meta.blockType;

                let autoTileIndex = 0;
                const neighbors = [
                    { dx: 0, dy: -1, bit: 1 }, // 上
                    { dx: 0, dy: 1, bit: 2 },  // 下
                    { dx: -1, dy: 0, bit: 4 }, // 左
                    { dx: 1, dy: 0, bit: 8 }   // 右
                ];

                for (const n of neighbors) {
                    const nx = cx + n.dx;
                    const ny = cy + n.dy;
                    const neighbor = this.get(nx, ny);
                    if (neighbor) {
                        const neighborItem = $dataItems[neighbor.itemId];
                        if (neighborItem?.meta?.blockType === thisType) {
                            autoTileIndex += n.bit;
                        }
                    }
                }

                targetTileId = autoTileIndex + 1;

                if (RSTH_DEBUG_LOG) console.log(`[addSprite][autoTile] (${block.x}, ${block.y}) index=${autoTileIndex} → tileId=${targetTileId}`);
            }

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
                if (RSTH_DEBUG_LOG) console.warn("[addSprite] tileOffsets parse error", e);
            }


            const id = targetTileId - 1;
            const col = id % cols;
            const row = Math.floor(id / cols);
            sprite.setFrame(col * tileSize, row * tileSize, tileSize, tileSize);

            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            sprite.anchor.x = 0;
            sprite.anchor.y = 0;

            sprite.x = Math.round(block.x * $gameMap.tileWidth() - $gameMap.displayX() * $gameMap.tileWidth());
            sprite.y = Math.round(block.y * $gameMap.tileHeight() - $gameMap.displayY() * $gameMap.tileHeight());




            // ▼ sprite.z の決定
            if (blockZ === "under") {
                const blockType = item.meta.blockType || "ground";
                switch (blockType) {
                    case "ground": sprite.z = 1; break;
                    case "floor": sprite.z = 2; break;
                    case "wall": sprite.z = 3; break;
                    case "furniture": sprite.z = 3; break;
                    case "plant": sprite.z = 3; break;
                    default: sprite.z = 2; break;
                }
            } else if (blockZ === "over") {
                sprite.z = 5;
            } else {
                sprite.z = 2;
            }

            sprite.block = block;
            sprite._growthApplied = block._growthApplied === true;

            const spriteset = SceneManager._scene?._spriteset;
            if (spriteset && spriteset._tilemap) {
                // 同じ位置にある既存スプライト（別レイヤー）を全て取得
                const existingSprites = this._sprites.filter(s =>
                    s.block?.x === block.x &&
                    s.block?.y === block.y &&
                    s.z === sprite.z // zが一致するスプライトは1つだけ許す
                );
                for (const old of existingSprites) {
                    if (RSTH_DEBUG_LOG) console.log(`[addSprite] 既存スプライト(${old.block.itemId})を削除 (z=${old.z})`);
                    spriteset._tilemap.removeChild(old);
                    this._sprites.splice(this._sprites.indexOf(old), 1);
                }

                spriteset._tilemap.addChild(sprite);
                this._sprites.push(sprite);

                if (RSTH_DEBUG_LOG) {
                    console.log("[addSprite] sprite を tilemap に追加完了");
                    const countAtSamePos = this._sprites.filter(s => s.block?.x === block.x && s.block?.y === block.y).length;
                    console.log(`[addSprite] (${block.x}, ${block.y}) 現在のスプライト数: ${countAtSamePos}`);
                }
            } else {
                if (RSTH_DEBUG_LOG) console.warn("[addSprite] spriteset または tilemap が null");
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
                                blockType: item.meta.blockType || window.RSTH_IH.GrowBlock
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
            const blocksToRemove = [];

            for (const sprite of this._sprites) {
                const block = sprite.block;
                if (!block) continue;

                // itemId が指定されており、ブロックと一致しなければスキップ
                if (itemId !== null && block.itemId !== itemId) continue;

                const item = $dataItems[block.itemId];
                if (!item || !item.meta.tileOffsets1) continue;

                let tileOffsets;
                try {
                    tileOffsets = item._tileOffsets1Parsed || [];
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn("[removeSpriteAt] tileOffsets1 parse error", e);
                    continue;
                }

                const matched = tileOffsets.some(offset => {
                    const px = block.originX + (offset.dx || 0);
                    const py = block.originY + (offset.dy || 0);
                    return px === x && py === y;
                });

                if (matched) {
                    blocksToRemove.push(sprite);
                }
            }

            for (const sprite of blocksToRemove) {
                if (sprite.parent) sprite.parent.removeChild(sprite);
                if (RSTH_DEBUG_LOG) console.log(`[removeSpriteAt] スプライト削除: (${x}, ${y})${itemId !== null ? ` itemId: ${itemId}` : ""}`);
            }

            // リストからも除去
            this._sprites = this._sprites.filter(sprite => !blocksToRemove.includes(sprite));

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
            const limit = 60;
            let count = 0;
            while (this._spriteAddQueue.length > 0 && count < limit) {
                const block = this._spriteAddQueue.shift();
                this.addSprite(block, true); // ← 強制描画フラグを渡す
                count++;
            }
        }

        ,

        refreshNearbySprites(px, py) {
            const chunkSize = 10;
            const chunkRange = 3;
            const skipRange = 2; // 視界内チャンク距離（±1）を除外

            this._loadedChunks ||= new Set();
            this._spriteAddQueue ||= [];

            const cx = Math.floor(px / chunkSize);
            const cy = Math.floor(py / chunkSize);

            for (let dx = -chunkRange; dx <= chunkRange; dx++) {
                for (let dy = -chunkRange; dy <= chunkRange; dy++) {
                    // 🔽 視界内チャンク（±1）はスキップ
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
                        this._spriteAddQueue.push(...blocksInChunk);
                        this._loadedChunks.add(chunkKey);
                        return; // 一度に1チャンクのみ処理
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
            const chunkSize = 10;
            const maxChunkDistance = 4;
            const currentChunkX = Math.floor(px / chunkSize);
            const currentChunkY = Math.floor(py / chunkSize);

            for (const chunkKey of [...this._loadedChunks]) {
                const [chunkX, chunkY] = chunkKey.split(',').map(Number);
                const dx = Math.abs(chunkX - currentChunkX);
                const dy = Math.abs(chunkY - currentChunkY);
                if (dx > maxChunkDistance || dy > maxChunkDistance) {
                    const startX = chunkX * chunkSize;
                    const startY = chunkY * chunkSize;
                    const endX = startX + chunkSize;
                    const endY = startY + chunkSize;

                    const spritesToRemove = this._sprites.filter(sprite => {
                        const bx = sprite.block?.x ?? -1;
                        const by = sprite.block?.y ?? -1;
                        return bx >= startX && bx < endX && by >= startY && by < endY;
                    });

                    for (const sprite of spritesToRemove) {
                        if (sprite.parent) sprite.parent.removeChild(sprite);
                    }

                    this._sprites = this._sprites.filter(s => !spritesToRemove.includes(s));
                    this._loadedChunks.delete(chunkKey);

                    if (RSTH_DEBUG_LOG) console.log(`[cleanupFarChunks] チャンク (${chunkX}, ${chunkY}) を削除`);
                }
            }
        }
        ,

        updateSpriteRefreshQueue() {
            while (this._spriteRefreshQueue.length > 0) {
                const { x, y } = this._spriteRefreshQueue.shift();
                const block = this.get(x, y);
                if (RSTH_DEBUG_LOG) console.log("→ 再描画: ", x, y, block);
                if (block) {
                    this.removeSpriteAt(x, y, block.itemId);
                    this.addSprite(block);
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