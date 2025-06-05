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
            const ox = $gameMap.displayX() * tw;
            const oy = $gameMap.displayY() * th;
            this.x = this.block.x * tw - ox;
            this.y = this.block.y * th - oy;
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

        place(x, y, itemId) {
            const item = $dataItems[itemId];

            if (!item || !item.meta || !item.meta.tileOffsets1) return;

            let tileOffsets = [];
            try {
                tileOffsets = JSON.parse(item.meta.tileOffsets1);
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
                const existingBlocks = this.getAll(px, py); // 配列で取得（getAll() は実装済み想定）
                const canStack = existingBlocks.every(existing => {
                    const type = $dataItems[existing.itemId]?.meta?.blockType || "unknown";
                    if (type === "ground" && (newBlockType === "floor" || newBlockType === "wall" || newBlockType === "furniture" || newBlockType === "plant")) return true;
                    if (type === "floor" && (newBlockType === "wall" || newBlockType === "furniture" || newBlockType === "plant")) return true;
                    return false;
                });

                if (!canStack && existingBlocks.length > 0) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] (${px}, ${py})には重ね置き不可のブロックが既に存在します`);
                    continue;
                }

                const isGrowBlock = newBlockType === window.RSTH_IH.GrowBlock;
                if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]isGrowBlock`, isGrowBlock);

                const block = {
                    x: px,
                    y: py,
                    tileId: tileId,
                    itemId: itemId,
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

                if (SceneManager._scene instanceof Scene_Map) {
                    this.addSprite(block);
                }

                // セーブ用に保存
                $gameSystem._survivalBlocks = $gameSystem._survivalBlocks || [];
                $gameSystem._survivalBlocks.push(block);



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

            // ドロップ処理
            const item = $dataItems[originBlock?.itemId];
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
                const ix = this._blocks.indexOf(block);
                if (ix >= 0) this._blocks.splice(ix, 1);
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
            return this._blocks.filter(block => block.x === x && block.y === y);
        },


        get(x, y) {
            const found = [...this._blocks].reverse().find(b => b.x === x && b.y === y);
            return found || null;
        },

        // ブロック用スプライト追加 ここでアイテムのメタタグのtileOffsets1を読み込んで処理
        addSprite(block) {
            if (RSTH_DEBUG_LOG) console.warn("[addSprite] start");
            const item = $dataItems[block.itemId];
            if (!item || !item.meta) {
                if (RSTH_DEBUG_LOG) console.error("[addSprite] $dataItems 未初期化 or item.meta 不正", block.itemId, $dataItems);
                if (RSTH_DEBUG_LOG) console.groupEnd();
                return;
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
            let tileOffsets = [];

            try {
                const tileOffsetsRaw = block.growthStage === 1
                    ? item.meta.tileOffsets2
                    : item.meta.tileOffsets1;

                tileOffsets = JSON.parse(tileOffsetsRaw || "[]");
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
            sprite.x = $gameMap.adjustX(block.x) * tw;
            sprite.y = $gameMap.adjustY(block.y) * th;

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


            if (RSTH_DEBUG_LOG) console.groupEnd();
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
                        const tileOffsets2 = JSON.parse(item.meta.tileOffsets2 || "[]");
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

                            const newBlock = {
                                x: bx,
                                y: by,
                                tileId: Number(offset.tileId),
                                itemId: updatedBlock.itemId,
                                passable: offset.hasOwnProperty("passable") ? !!offset.passable : true,
                                growthStage: 1,
                                _growthApplied: true,
                                _isGrowthRoot: isRoot,
                                originX,
                                originY,
                                blockType: item.meta.blockType || "ground"
                            };
                            blocksToAdd.push(newBlock);
                        }
                        if (RSTH_DEBUG_LOG) console.log("[SurvivalBlockManager][updateGrowthSprites]newBlock", newBlock);

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
                    tileOffsets = JSON.parse(item.meta.tileOffsets1 || "[]");
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
    };

    window.RSTH_IH.SurvivalBlockManager.breakWithDrop = function (x, y, dropItemData) {
        this.break(x, y);
        if (dropItemData) {
            window.RSTH_IH.DropManager.dropItem(x, y, dropItemData);
        }
    };

})();