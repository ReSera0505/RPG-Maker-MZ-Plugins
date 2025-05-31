/*:
 * @target MZ
 * @plugindesc RSTH_Survival: ブロック設置＆破壊システム ver1.0.2
 * @author ReSera_りせら
 *
 * @help
 * このプラグインは、マップ上にブロックを設置・破壊できる機能を追加します。
 * ツールによるブロック破壊や、破壊時のドロップ、ドロップアイテムの回収、
 * ドロップの永続保存、通行制御など、サバイバル要素の実装に対応しています。
 *
 * ▼ 主な機能（開発中です）
 * - ホットバーに登録したブロックをプレイヤー前方に設置可能
 * - ツール（toolタグ付き武器）で指定ブロックのみ破壊可能
 * - ブロック破壊時にアイテムをドロップ、近づくと自動回収
 * - 回収時は window.RSTH_IH.gainItemToInventoryThenHotbar() を使用
 * - 配置済みブロックとドロップはセーブデータに保存される
 * - ブロックはタイルID（tileId）で指定、タイルセット画像を使用
 * - ブロック上には通行不可になる（通行判定制御付き）
 *
 * ▼ 使用方法
 * 1. プラグインマネージャーで有効にしてください（RSTH_IH.jsより**下に**配置）
 * 2. タイル画像を指定し、アイテムに以下のメタタグを設定してください：
 *
 * ▼ ブロックアイテムのメタタグ例（通常アイテム）
 * <block>
 * <tileId:172>
 * <blockName:ドラゴンの石像>
 * <size:[2,2]>
 * <tileset:Inside_C>
 * <tileOffsets1:[
 *   {"dx":0,"dy":0,"tileId":172,"passable":true,"blockZ":"over"},
 *   {"dx":1,"dy":0,"tileId":173,"passable":true,"blockZ":"over"},
 *   {"dx":0,"dy":1,"tileId":188,"passable":false,"blockZ":"under"},
 *   {"dx":1,"dy":1,"tileId":189,"passable":false,"blockZ":"under"}
 * ]>
 * <tileOffsets2:[
 *   {"dx":0,"dy":0,"tileId":181,"passable":true,"blockZ":"under"},
 *   {"dx":1,"dy":0,"tileId":182,"passable":true,"blockZ":"under"},
 *   {"dx":0,"dy":1,"tileId":213,"passable":true,"blockZ":"over"},
 *   {"dx":1,"dy":1,"tileId":214,"passable":true,"blockZ":"over"}
 * ]>
 * <growthTime:200>
 * <dropItems1:itemId:4,amount:1>
 * <dropItems2:itemId:4,amount:3>
 * 以上がメモ欄へ記載するメタタグ。
 * tileIdはタイルセットのcols（1行に何個タイルがあるか）に影響されます。
 * colsが16の場合、1行目はtileId:1で、2行目はtileId:17となります。
 * colsはプラグインパラメータで変更が可能です。
 * 
 * <tileOffsets1:>と<tileOffsets2:>は成長前と成長後に
 * どのマスにどのtileIdを表示するかの指定、
 * passableはtrueで通行可能、falseで通行不可能の指定が可能です。
 * blockZはunderでプレイヤーより下層、overでプレイヤーより上層に
 * 表示されるようになります。
 * 
 * growthTimeはブロックが成長するまでの時間で、
 * 0の場合は成長しない普通のブロックとなります。
 * dropItems1は成長前、dropItems2は成長後に
 * ブロックを破壊すると落とすアイテムを指定できます。
 * 
 * 
 * ▼ ツール（武器）のメタタグ例（tool指定と破壊対象）
 * <tool>
 * <blockEffective:[1,2,3]>
 *
 * ▼ 使用例：スクリプトからブロックを設置・破壊
 * window.RSTH_IH.SurvivalBlockManager.place(x, y, tileId)
 * window.RSTH_IH.SurvivalBlockManager.break(x, y)
 * window.RSTH_IH.SurvivalBlockManager.get(x, y)
 *
 * ▼ 注意事項
 * - RSTH_IH.jsと併用必須。**必ず下に**配置してください。
 * - タイルIDはタイルセット画像（img/tilesets）内で左上から右下に番号を振ったものです。
 * - ブロックドロップは DropTable（内部定義）で tileId → itemId を対応付けします。
 * - ドロップされたアイテムは自動でアイコン表示され、近づくと自動取得されます。
 * - 通行判定をオーバーライドしているため、マップタイルの通行不可と併用注意。
 *
 * ▼ ライセンス
 * このプラグインは MITライセンス の下で公開されています。
 * 
 * ▼ 使用方法
 * プロジェクトの「js/plugins」フォルダにこのファイルのみを追加し、
 * プラグインマネージャーから有効にしてください。 
 * 他のファイルは内部的に自動的に使用されます。
 * 
 * ◆構成ファイル（すべて js/plugins/ に配置）
 * - RSTH_Survival.js            … 統合管理用
 * - RSTH_Survival_Core.js       … コア（名前空間、共通関数）
 * - RSTH_Survival_Placer.js     … ブロックの設置・破壊
 * - RSTH_Survival_Sprite.js     … ブロック表示・描画処理
 * - RSTH_Survival_SaveLoad.js   … セーブ・ロード処理
 * - RSTH_Survival_Growth.js     … 成長・時間管理
 * 
 * ----------------------------
 * 変更履歴:
 * ----------------------------
 * 
 * Ver.1.0.2 - 2025/05/31
 *   - 成長するブロックの実装。
 *     アイテム欄のメモ欄のメタタグの記載方法を変更。
 * 
 * Ver.1.0.1 - 2025/05/29
 *   - 縦２マス横２マスなどの複数のマスを使用するブロックの配置を可能とした。
 *     アイテム欄のメモ欄に各指定に対応するメタタグを記載することで、
 *     通行可能、不可能の指定、
 *     プレイヤーより上層か下層に表示する指定、使用するタイルセットの指定、
 *     縦〇マス、横〇マスというようなブロックのサイズの指定、
 *     どのマスにどのIDのタイルを使用するか等の指定が可能。
 *   - ドロップアイテムの再拾得時間を1秒に設定。
 * 
 * Ver.1.0.0 - 2025/05/25
 *   - 初版公開
 * 
 * @param TilesetConfigs
 * @text タイルセット設定
 * @type struct<TilesetConfig>[]
 * @default []
 * @desc タイルセットごとの tileSize や cols 設定
 */

/*~struct~TilesetConfig:
 * @param name
 * @text タイルセット名
 * @desc タイル画像ファイル名（拡張子不要）
 * 
 * @param tileSize
 * @text タイルサイズ
 * @type number
 * @default 48
 *
 * @param cols
 * @text 列数
 * @type number
 * @default 16
 */


(() => {
    //この行が即時関数の始まり

    "use strict";

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    const RSTH_DEBUG_LOG = false;

    const p = PluginManager.parameters("RSTH_Survival");

    const TILESET_NAME = p["TilesetName"] || "Inside_C";

    const tilesetConfigsRaw = p["TilesetConfigs"] || "[]";
    const tilesetConfigs = JSON.parse(tilesetConfigsRaw).map(json => {
        const cfg = JSON.parse(json);
        return {
            name: cfg.name || "Inside_C",
            tileSize: Number(cfg.tileSize || 48),
            cols: Number(cfg.cols || 16)
        };
    });

    function getTilesetConfigByName(name) {
        return tilesetConfigs.find(cfg => cfg.name === name) || {
            name: name,
            tileSize: 48,
            cols: 16
        };
    }

    window.RSTH_IH = window.RSTH_IH || {};

    window.RSTH_IH.__needGrowthSpriteUpdate = false;

    //=============================================================================================================
    // ブロックの設置、破壊、更新などの処理===========================================================================
    //=============================================================================================================
    //「壊せる・設置できる」ブロックの見た目を制御するスプライトクラス。
    class Sprite_SurvivalBlock extends Sprite {
        constructor(block) {
            super();
            const item = $dataItems[block.itemId];
            if (!item || !item.meta) {
                if (RSTH_DEBUG_LOG) console.error("[Sprite_SurvivalBlock] $dataItems 未初期化 or item.meta 不正", block.itemId, $dataItems);
                return; // クラッシュ防止
            }
            const tilesetName = item?.meta?.tileset || TILESET_NAME;
            const cfg = getTilesetConfigByName(tilesetName);
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

            for (const offset of tileOffsets) {
                const px = x + (offset.dx || 0);
                const py = y + (offset.dy || 0);

                if (px < 0 || py < 0 || px >= $gameMap.width() || py >= $gameMap.height()) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] 座標(${px}, ${py})はマップ外です。設置をスキップします。`);
                    continue;
                }

                const tileId = Number(offset.tileId || 0);
                const passable = !!offset.passable;

                if (this.get(px, py)) continue;

                const block = {
                    x: px,
                    y: py,
                    tileId: tileId,
                    itemId: itemId,
                    passable: passable,
                    originX: x,
                    originY: y,
                    growthStage: 0,         // 成長段階を初期化
                    _growthApplied: false   // スプライト適用済みフラグを初期化
                };

                // マップシーン中なら即スプライト追加
                this._blocks.push(block);

                if (SceneManager._scene instanceof Scene_Map) {
                    this.addSprite(block);
                }

                // セーブ用に保存
                $gameSystem._survivalBlocks = $gameSystem._survivalBlocks || [];
                $gameSystem._survivalBlocks.push(block);


                getBlocks_and_Spriteslist("SurvivalBlockManager");


            }
        }

        ,

        break(x, y) {
            let target = this.get(x, y);

            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][break] START x=${x} y=${y}`);
            if (!target) return;

            const originX = target.originX ?? target.x;
            const originY = target.originY ?? target.y;
            const originBlock = this.get(originX, originY);
            const isGrown = originBlock?.growthStage === 1;

            // ブロックに対応するアイテムの取得
            const item = $dataItems[originBlock?.itemId];
            if (item) {
                try {
                    const dropMeta = isGrown ? item.meta.dropItems2 : item.meta.dropItems1;
                    if (dropMeta) {
                        // 例: "itemId:4,amount:3"
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
                                DropManager.dropItem(originX, originY, $dataItems[dropId]);
                            }
                        }
                    }
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][break] ドロップ解析失敗`, e);
                }
            }

            // ブロック削除
            const toRemove = this._blocks.filter(b =>
                b.originX === originX && b.originY === originY
            );

            for (const block of toRemove) {
                const ix = this._blocks.indexOf(block);
                if (ix >= 0) this._blocks.splice(ix, 1);
                this.removeSpriteAt(block.x, block.y);
            }
        }





        ,


        get(x, y) {
            return this._blocks.find(b => b.x === x && b.y === y);
        },

        // ブロック用スプライト追加 ここでアイテムのメタタグのtileOffsets1を読み込んで処理
        addSprite(block) {

            getBlocks_and_Spriteslist("addSprite(block)_1"); // DEBUG：一覧出力
            const item = $dataItems[block.itemId];
            if (!item || !item.meta) {
                if (RSTH_DEBUG_LOG) console.error("[addSprite] $dataItems 未初期化 or item.meta 不正", block.itemId, $dataItems);
                if (RSTH_DEBUG_LOG) console.groupEnd();
                return;
            }

            const tilesetName = item?.meta?.tileset || TILESET_NAME;
            const cfg = getTilesetConfigByName(tilesetName);
            const tileSize = cfg.tileSize;
            const cols = cfg.cols;


            const sprite = new Sprite_SurvivalBlock(block);
            sprite.bitmap = ImageManager.loadTileset(tilesetName);

            let dx = 0, dy = 0;
            let blockZ = "over";
            let targetTileId = block.tileId;

            let tileOffsets = [];
            try {
                const tileOffsetsRaw = block.growthStage === 1
                    ? item.meta.tileOffsets2
                    : item.meta.tileOffsets1;


                tileOffsets = JSON.parse(tileOffsetsRaw || "[]");

                //const offset = tileOffsets.find(o => Number(o.tileId) === block.tileId);
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
            sprite.z = blockZ === "under" ? 0 : blockZ === "over" ? 5 : 2;

            //getBlocks_and_Spriteslist("addSprite(block)_3"); // DEBUG：一覧出力
            sprite.block = block;
            sprite._growthApplied = block._growthApplied === true;

            //getBlocks_and_Spriteslist("addSprite(block)_4"); // DEBUG：一覧出力

            const spriteset = SceneManager._scene?._spriteset;
            if (spriteset && spriteset._tilemap) {
                spriteset._tilemap.addChild(sprite);
                this._sprites.push(sprite);
                if (RSTH_DEBUG_LOG) console.log("[addSprite] sprite を tilemap に追加完了");
            } else {
                if (RSTH_DEBUG_LOG) console.warn("[addSprite] spriteset または tilemap が null");
            }

            //getBlocks_and_Spriteslist("addSprite(block)_5"); // DEBUG：一覧出力
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
                            };
                            blocksToAdd.push(newBlock);
                        }

                    } catch (e) {
                        if (RSTH_DEBUG_LOG) console.warn("[updateGrowthSprites] tileOffsets2 parse error", e);
                    }
                }
            }

            // 古いブロック削除
            this._blocks = this._blocks.filter(b => {
                return !positionsToRemove.has(`${b.x},${b.y}`);
            });

            // 古いスプライト削除
            this._sprites = this._sprites.filter(sprite => {
                const bx = sprite.block?.x;
                const by = sprite.block?.y;
                const key = `${bx},${by}`;
                if (!positionsToRemove.has(key)) return true;

                if (sprite && sprite.parent && typeof sprite.parent.removeChild === "function") {
                    sprite.parent.removeChild(sprite);
                }
                return false;
            });

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

            getBlocks_and_Spriteslist("updateGrowthSprites_2"); // DEBUG：一覧出力
        }

        ,


        removeSpriteAt(x, y) {
            const blocksToRemove = [];

            for (const sprite of this._sprites) {
                const block = sprite.block;
                if (!block) continue;

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
                    const px = block.x + (offset.dx || 0);
                    const py = block.y + (offset.dy || 0);
                    return px === x && py === y;
                });

                if (matched) {
                    blocksToRemove.push(sprite);
                }
            }

            for (const sprite of blocksToRemove) {
                if (sprite.parent) sprite.parent.removeChild(sprite);
                if (RSTH_DEBUG_LOG) console.log(`[removeSpriteAt] スプライト削除: (${x}, ${y})`);
            }

            // リストからも除去
            this._sprites = this._sprites.filter(sprite => !blocksToRemove.includes(sprite));
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
            DropManager.dropItem(x, y, dropItemData);
        }
    };

    //=============================================================================================================
    // ブロック情報関連===============================================================================================
    //=============================================================================================================

    // 全アイテムのメモ欄を解析し、blockMetaList に保存
    Game_System.prototype.rsthLoadBlockDataFromDatabase = function () {
        if (!this._blockMetaList) this._blockMetaList = [];


        for (const item of $dataItems) {
            if (!item || !item.meta["block"]) continue;

            if (RSTH_DEBUG_LOG) console.log(`[rsthLoadBlockDataFromDatabase] item`, item.id, item.meta);
            const meta = item.meta;

            // tileOffsets1
            let tileOffsets1 = [];
            try {
                tileOffsets1 = JSON.parse(meta.tileOffsets1 || "[]");
            } catch (e) {
                if (RSTH_DEBUG_LOG) console.error("[rsthLoadBlockDataFromDatabase] tileOffsets1 JSON parse error:", e, meta.tileOffsets1);
            }

            // tileOffsets2
            let tileOffsets2 = [];
            try {
                tileOffsets2 = JSON.parse(meta.tileOffsets2 || "[]");
            } catch (e) {
                if (RSTH_DEBUG_LOG) console.error("[rsthLoadBlockDataFromDatabase] tileOffsets2 JSON parse error:", e, meta.tileOffsets2);
            }

            const data = {
                itemId: item.id,
                name: meta.blockName || item.name,
                tileId: Number(meta.tileId || 0),
                size: JSON.parse(meta.size || "[1,1]"),
                tileset: meta.tileset || "Inside_C",
                growthTime: Number(meta.growthTime || 0),
                tileOffsets1: tileOffsets1,
                tileOffsets2: tileOffsets2,
                dropItems1: parseDropItems(meta.dropItems1),
                dropItems2: parseDropItems(meta.dropItems2),
                meta: meta // 全メタを保存（後でブロックへコピー用）
            };

            this._blockMetaList.push(data);

            if (RSTH_DEBUG_LOG) console.log(`[rsthLoadBlockDataFromDatabase] this._blockMetaList`, this._blockMetaList);
        }
    };


    Game_System.prototype.rsthgetBlockMetaByItemId = function (itemId) {
        if (!Array.isArray(this._blockMetaList)) return null;
        return this._blockMetaList.find(b => b.itemId === itemId);
    };

    function parseDropItems(tag) {
        if (!tag) return [];
        return tag.split(";").map(entry => {
            const m = /itemId:(\d+),amount:(\d+)/.exec(entry);
            if (m) return { itemId: Number(m[1]), amount: Number(m[2]) };
            return null;
        }).filter(Boolean);
    }

    // ブロックが通行可能、不可能か判定する
    const _Game_Map_isPassable = Game_Map.prototype.isPassable;
    Game_Map.prototype.isPassable = function (x, y, d) {
        const block = window.RSTH_IH.SurvivalBlockManager.get(x, y);
        if (block) {
            if (block.passable === undefined) {
                if (RSTH_DEBUG_LOG) console.warn("[isPassable] passable が undefined のブロックを検出:", block);
            }

            if (RSTH_DEBUG_LOG) console.warn(`[isPassable]block`, block);
            return block.passable === true;
        }
        return _Game_Map_isPassable.call(this, x, y, d);
    };

    window.RSTH_IH.placeBlockFromItem = function (item) {
        if (!item || item.type !== "block" || !item.tileOffsets) return false;

        const [x, y] = getFrontTileXY();

        try {
            const parsedOffsets = JSON.parse(item.tileOffsets);

            for (const offset of parsedOffsets) {
                const px = x + (offset.dx || 0);
                const py = y + (offset.dy || 0);
                const tileId = Number(offset.tileId || 0);
                const passable = !!offset.passable;

                if (window.RSTH_IH.SurvivalBlockManager.get(px, py)) continue;

                const block = {
                    x: px,
                    y: py,
                    tileId: tileId,
                    itemId: item.id,
                    passable: passable,
                    originX: x,
                    originY: y,
                    growthStage: 0,        // ★成長しない場合でも必ず数値で初期化
                    _growthApplied: false  // ★false明示でセーブ・ロード対応
                };

                window.RSTH_IH.SurvivalBlockManager._blocks.push(block);
                window.RSTH_IH.SurvivalBlockManager.addSprite(block);
            }

            window.RSTH_IH.removeItemFromInventoryOrHotbar(item, 1);
            return true;

        } catch (e) {
            if (RSTH_DEBUG_LOG) console.log("[placeBlockFromItem] tileOffsets parse error:", e);
            return false;
        }
    };

    //=============================================================================================================
    // ドロップアイテム関連===============================================================================================
    //=============================================================================================================

    class DroppedItem {
        constructor(x, y, itemData) {
            this.x = x;
            this.y = y;
            this.item = itemData;
            this.sprite = null;
            this._collected = false;
            this._retryCooldown = 0; // 追加：再試行までのクールダウン

        }
    }

    // アイテムドロップ（落ちてるアイテム）管理クラス
    const DropManager = {
        _drops: [],

        dropItem(x, y, itemData) {
            const drop = new DroppedItem(x, y, itemData);
            drop._collected = false;
            this._drops.push(drop);
            this.createSprite(drop);
        }
        ,

        // 地面に落ちてるアイテムをスプライトで表示
        createSprite(drop) {
            if (!drop || !drop.item || drop.item.iconIndex == null) {
                if (RSTH_DEBUG_LOG) console.warn(`[createSprite] Invalid drop or item:`, drop);
                return;
            }
            if (RSTH_DEBUG_LOG) console.log(`[createSprite] for drop (${drop.x}, ${drop.y})`);

            const sprite = new Sprite();
            sprite.bitmap = ImageManager.loadSystem("IconSet");
            const iconIndex = drop.item.iconIndex;
            const sx = (iconIndex % 16) * 32;
            const sy = Math.floor(iconIndex / 16) * 32;
            sprite.setFrame(sx, sy, 32, 32);

            sprite.z = 1; // プレイヤーより下層に描画（通常プレイヤーは z=3 付近）

            // ▼ 初期位置を明示的に設定（1フレーム目描画前に）
            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const ox = $gameMap.displayX() * tw;
            const oy = $gameMap.displayY() * th;
            sprite.x = drop.x * tw - ox + 8;
            sprite.y = drop.y * th - oy + 8;

            sprite.update = function () {
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();
                const ox = $gameMap.displayX() * tw;
                const oy = $gameMap.displayY() * th;
                this.x = drop.x * tw - ox + 8;
                this.y = drop.y * th - oy + 8;
            };

            const spriteset = SceneManager._scene._spriteset;
            spriteset._tilemap.addChild(sprite);
            drop.sprite = sprite;
        }
        ,

        update() {
            const px = $gamePlayer.x;
            const py = $gamePlayer.y;

            for (let i = this._drops.length - 1; i >= 0; i--) {
                const drop = this._drops[i];

                if (!drop) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]drop is null at index ${i}`);
                    continue;
                }

                if (!drop.item) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSpriteupdate()]drop.item is null at (${drop.x}, ${drop.y})`);
                    continue;
                }

                if (drop._collected) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSpriteupdate()]skip: already collected (${drop.x},${drop.y})`);
                    continue;
                }

                const dx = drop.x - px;
                const dy = drop.y - py;
                const dist = Math.abs(dx) + Math.abs(dy);

                if (drop._collected || drop._retryCooldown > 0) {
                    drop._retryCooldown--;
                    continue;
                }


                if (dist <= 1) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]回収可能距離に入りました (${drop.x},${drop.y}) → dist=${dist}`);
                    const success = window.RSTH_IH.gainItemToInventoryThenHotbar(drop.item, drop.item.count || 1);
                    if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]gainItem success=${success}`);
                    if (success) {
                        drop._collected = true;
                        if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]_collected フラグを true に設定: (${drop.x}, ${drop.y})`);
                        this.remove(drop);
                        if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]remove() 実行: (${drop.x}, ${drop.y})`);
                    } else {
                        drop._retryCooldown = 60; // 約1秒間再試行しない
                    }
                }
            }
        }
        ,

        remove(drop) {
            if (!drop) return;

            if (drop.sprite) {
                const sprite = drop.sprite;
                drop.sprite = null;

                // 親ノードが存在するか確認してから削除
                if (sprite.parent) {
                    sprite.parent.removeChild(sprite);
                    if (RSTH_DEBUG_LOG) console.log(`[remove] sprite removed via parent`);
                } else if (SceneManager._scene && SceneManager._scene._spriteset) {
                    // 念のため spriteset からも削除
                    SceneManager._scene._spriteset.removeChild(sprite);
                    if (RSTH_DEBUG_LOG) console.log(`[remove] sprite removed from spriteset fallback`);
                }
            }

            const index = this._drops.indexOf(drop);
            if (index >= 0) {
                this._drops.splice(index, 1);
                if (RSTH_DEBUG_LOG) console.log(`[remove] drop removed from _drops[]`);
            }
        }




    };


    //=============================================================================================================
    // その他処理===============================================================================================
    //=============================================================================================================

    //プレイヤーの前のタイルのxyを調べる
    function getFrontTileXY() {
        const dir = $gamePlayer.direction();
        const x = $gamePlayer.x + (dir === 6 ? 1 : dir === 4 ? -1 : 0);
        const y = $gamePlayer.y + (dir === 2 ? 1 : dir === 8 ? -1 : 0);
        return [x, y];
    }

    //update処理
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        //getBlocks_and_Spriteslist("_Scene_Map_update_0"); // DEBUG：一覧出力
        _Scene_Map_update.call(this);
        const mgr = window.RSTH_IH.SurvivalBlockManager;

        //getBlocks_and_Spriteslist("_Scene_Map_update_1"); // DEBUG：一覧出力
        if (mgr && window.RSTH_IH.__needGrowthSpriteUpdate) {
            mgr.updateGrowthSprites();
            window.RSTH_IH.__needGrowthSpriteUpdate = false; // 🔁 消費後フラグを戻す
            window.RSTH_IH.__rsthNeedSpriteRefresh = true;   // ★ 成長後のタイル描画を強制更新
        }

        // ★ 描画リフレッシュ処理（スプライト更新後に実行）
        if (window.RSTH_IH.__rsthNeedSpriteRefresh) {
            window.RSTH_IH.__rsthNeedSpriteRefresh = false;
            if (this._spriteset && this._spriteset._tilemap) {
                this._spriteset._tilemap.refresh();
            }
        }

        if ($gameSystem.rsthupdateGrowthTimers) {
            $gameSystem.rsthupdateGrowthTimers();
        }
        DropManager.update();

        getBlocks_and_Spriteslist("_Scene_Map_update_2"); // DEBUG：一覧出力
    };


    // ★ セーブ内容にブロックとドロップデータを追加
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const contents = _DataManager_makeSaveContents.call(this);
        if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] セーブデータ作成開始");

        // ブロックデータを整形して保存（副次ブロックは除外）
        contents.survivalBlocks = window.RSTH_IH.SurvivalBlockManager._blocks.filter(block => {
            // 成長済みブロックなら中心のみ（_growthAppliedがfalseか未定義）
            if (block.growthStage === 1 && block._growthApplied) {
                return block._isGrowthRoot; // 中心ブロックだけ保存
            }
            return true;
        }).map(block => ({
            x: block.x,
            y: block.y,
            tileId: block.tileId,
            itemId: block.itemId,
            passable: (block.passable !== undefined) ? !!block.passable : true,
            growthStage: (block.growthStage !== undefined) ? block.growthStage : 0,
            _growthApplied: (block._growthApplied !== undefined) ? block._growthApplied : false,
            _isGrowthRoot: (block._isGrowthRoot !== undefined) ? block._isGrowthRoot : false,
            originX: (block.originX !== undefined) ? block.originX : null,
            originY: (block.originY !== undefined) ? block.originY : null
        }));

        // ドロップアイテムを保存
        contents.survivalDrops = DropManager._drops.map(drop => {
            if (!drop.item || drop.item.id == null) return null;
            return {
                x: drop.x,
                y: drop.y,
                itemId: drop.item.id
            };
        }).filter(e => e); // null除去

        //getBlocks_and_Spriteslist("makeSaveContents");

        return contents;
    };

    // ★ サバイバルマネージャ初期化
    window.RSTH_IH = window.RSTH_IH || {};
    window.RSTH_IH.SurvivalBlockManager = window.RSTH_IH.SurvivalBlockManager || {};

    const SurvivalBlockManager = window.RSTH_IH.SurvivalBlockManager;

    SurvivalBlockManager.rsthLoadBlockDataFromDatabase = function () {
        if (!RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] rsthLoadBlockDataFromDatabase 開始");

        if (!$dataItems) {
            if (!RSTH_DEBUG_LOG) console.warn("[RSTH DEBUG] $dataItems が未定義のため中止");
            return;
        }

        this._blockMetaList = [];
        for (const item of $dataItems) {
            if (item && item.meta && Boolean(item.meta.block)) {
                this._blockMetaList.push(item);
                if (!RSTH_DEBUG_LOG) console.log(`[RSTH DEBUG] 登録: itemId=${item.id}, name=${item.name}`);
            }
        }

        if (!RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] rsthLoadBlockDataFromDatabase 完了: 登録件数 =", this._blockMetaList.length);
    };

    // ★ ロード内容の展開
    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        window.RSTH_IH.__lastSaveContents = contents;
        _DataManager_extractSaveContents.call(this, contents);

        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] extractSaveContents 実行開始");

        const manager = window.RSTH_IH.SurvivalBlockManager;

        // ブロック定義データを再ロード（ロードデータと干渉する場合はコメントアウト可能）
        if (typeof manager.rsthLoadBlockDataFromDatabase === "function") {
            manager.rsthLoadBlockDataFromDatabase();
        }

        // セーブからブロック情報復元（originX / originY を必ず保持）
        manager._blocks = (contents.survivalBlocks || []).map(b => ({
            x: b.x,
            y: b.y,
            tileId: b.tileId,
            itemId: b.itemId,
            passable: (typeof b.passable === "boolean") ? b.passable : true,
            growthStage: b.growthStage ?? 0,
            _growthApplied: b._growthApplied ?? false,
            _isGrowthRoot: b._isGrowthRoot ?? false,
            originX: (typeof b.originX === "number") ? b.originX : null,
            originY: (typeof b.originY === "number") ? b.originY : null
        }));

        // スプライトを初期化（描画は後で再構築）
        manager._sprites = [];

        // ★ 再描画フラグを設定：onMapLoaded内で updateGrowthSprites による再構築を促す
        window.RSTH_IH.__needGrowthSpriteUpdate = true;

        // ドロップデータ復元
        DropManager._drops = [];
        if (contents.survivalDrops) {
            for (const d of contents.survivalDrops) {
                const item = $dataItems[d.itemId];
                if (item && item.iconIndex != null) {
                    DropManager._drops.push(new DroppedItem(d.x, d.y, item));
                } else if (RSTH_DEBUG_LOG) {
                    console.warn(`[extractSaveContents] Invalid itemId: ${d.itemId}, drop skipped.`);
                }
            }
        }

        getBlocks_and_Spriteslist("_DataManager_extractSaveContents");
        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] extractSaveContents 完了");
    };

    // ★ マップロード完了後にスプライトを生成
    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);

        getBlocks_and_Spriteslist("_Scene_Map_onMapLoaded_1");
        const manager = window.RSTH_IH?.SurvivalBlockManager;

        // ドロップスプライト復元
        for (const drop of DropManager._drops) {
            if (!drop.item || drop.item.iconIndex == null) {
                if (RSTH_DEBUG_LOG) console.warn(`[onMapLoaded] Drop item invalid, skipping sprite:`, drop);
                continue;
            }
            if (drop.sprite) {
                SceneManager._scene._spriteset.removeChild(drop.sprite);
                drop.sprite = null;
            }
            DropManager.createSprite(drop);
        }


        // 成長スプライト更新
        if (manager?.updateGrowthSprites) {
            manager.updateGrowthSprites();
        }


        // スプライト追加は描画準備完了後（次フレーム）に遅延実行
        setTimeout(() => {
            const manager = window.RSTH_IH.SurvivalBlockManager;
            manager._sprites = [];

            const handledPositions = new Set();
            const newBlocks = [];

            getBlocks_and_Spriteslist("_Scene_Map_onMapLoaded_2");
            for (const block of manager._blocks) {
                const key = `${block.x},${block.y}`;
                if (handledPositions.has(key)) continue;

                const item = $dataItems[block.itemId];
                if (!item) continue;

                const tileOffsets2 = JSON.parse(item.meta.tileOffsets2 || "[]");
                const mainTile = tileOffsets2.find(t => t.dx === 0 && t.dy === 0);

                if (block.growthStage === 1 && tileOffsets2.length > 0) {
                    // tileOffsets2 で分割再構成
                    for (const offset of tileOffsets2) {
                        const bx = block.x + (offset.dx || 0);
                        const by = block.y + (offset.dy || 0);
                        handledPositions.add(`${bx},${by}`);

                        const newBlock = {
                            x: bx,
                            y: by,
                            tileId: Number(offset.tileId),
                            itemId: block.itemId,
                            passable: (typeof offset.passable === "boolean") ? offset.passable : true,
                            growthStage: 1,
                            _growthApplied: true,
                            originX: block.originX ?? block.x,
                            originY: block.originY ?? block.y,
                            _isGrowthRoot: (offset.dx === 0 && offset.dy === 0),
                        };
                        newBlocks.push(newBlock);
                        manager.addSprite(newBlock);
                    }
                } else {
                    handledPositions.add(key);
                    newBlocks.push(block);
                    manager.addSprite(block);
                }
            }

            // ★ manager._blocks を tileOffsets2 展開後の新しい配列に置き換え
            manager._blocks = newBlocks;
        }, 0);

        getBlocks_and_Spriteslist("_Scene_Map_onMapLoaded_3");

    };

    // 一部のデバッグ用コンソール表示
    function getBlocks_and_Spriteslist(call) {
        if (!RSTH_DEBUG_LOG) return;
        console.log("[getBlocks_and_Spriteslist]現在マップ上に配置されているブロック一覧:", call);
        console.table(window.RSTH_IH.SurvivalBlockManager._blocks);

        console.log("[getBlocks_and_Spriteslist]現在マップ上に表示されているブロックスプライト一覧:", call);
        console.table(window.RSTH_IH.SurvivalBlockManager._sprites.map(sprite => ({
            x: sprite.block?.x,
            y: sprite.block?.y,
            tileId: sprite.block?.tileId,
            itemId: sprite.block?.itemId,
            growthStage: sprite.block?.growthStage,
            passable: sprite.block?.passable,
            _growthApplied: sprite.block?._growthApplied
        })));
    }

    // ニューゲーム処理
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);

        window.RSTH_IH.SurvivalBlockManager._blocks = [];
        window.RSTH_IH.SurvivalBlockManager._sprites = [];

        DropManager._drops = [];

        if (RSTH_DEBUG_LOG) console.log("[_DataManager_setupNewGame]ニューゲーム：window.RSTH_IH.SurvivalBlockManager / DropManager を初期化");
    };

    // プレイヤーを平行移動可能にする処理
    const _Game_Player_moveByInput = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function () {
        // Ctrl押下中かつ移動中でない場合 → 平行移動
        if (Input.isPressed("control") && this.canMove() && !this.isMoving()) {
            const dir = Input.dir4;
            if (dir !== 0 && this.canPass(this.x, this.y, dir)) {
                const originalDirection = this.direction(); // 向きを記憶
                this.moveStraight(dir);                     // 一歩移動（向きも変わる）
                this.setDirection(originalDirection);       // 向きを戻す（＝見た目は平行移動）
                return;
            }
        }

        // 通常の移動（矢印キー、クリック移動を含む）
        _Game_Player_moveByInput.call(this);
    };

    //=============================================================================================================
    // ブロックの成長処理関連===============================================================================================
    //=============================================================================================================
    Game_System.prototype.rsthgetBlockDataById = function (blockId) {
        const all = this._furnitureData?.all || [];
        return all.find(data => data.id === blockId) || null;
    };

    Game_System.prototype.rsthgetBlockGrowthStageData = function (blockId, stage) {
        const block = this.rsthgetBlockDataById(blockId);
        if (!block || !block.growthStages) return block;
        return block.growthStages[stage] || block;
    };

    Game_System.prototype._growingTimers = [];

    // フレームごとに呼ばれる成長タイマー更新処理
    Game_System.prototype.rsthupdateGrowthTimers = function () {
        if (!this._growingTimers) this._growingTimers = [];

        if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]this._growingTimers`, this._growingTimers);
        for (const timer of this._growingTimers) {
            timer.time--;
            if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]timer`, timer);
            if (timer.time <= 0) {
                const block = window.RSTH_IH.SurvivalBlockManager.get(timer.x, timer.y);
                if (!block) continue;

                const item = $dataItems[block.itemId];
                if (!item || !item.meta.tileOffsets2) continue;

                try {
                    const parsedOffsets = JSON.parse(item.meta.tileOffsets2);
                    block.growthStage = 1; // ステージ更新
                    window.RSTH_IH.__needGrowthSpriteUpdate = true;
                    if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]block`, block);
                    if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]block.growthStage`, block.growthStage);
                    if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers] (${block.x},${block.y}) が tileOffsets2 に成長しました`);

                    //同期処理：SurvivalBlockManager._blocks側にも反映
                    const placedBlock = window.RSTH_IH.SurvivalBlockManager._blocks.find(b => b.x === block.x && b.y === block.y);
                    if (placedBlock) {
                        placedBlock.growthStage = 1;
                    }


                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn("[rsthupdateGrowthTimers] [成長処理エラー]", e);
                }

                timer.done = true;
            }
        }

        // 成長終了タイマーの除去
        this._growingTimers = this._growingTimers.filter(t => !t.done);
    };

    // 成長タイマーの追加
    Game_System.prototype.rsthstartGrowthTimer = function (x, y, time) {
        if (!this._growingTimers) this._growingTimers = [];
        this._growingTimers.push({ x, y, time });
        if (RSTH_DEBUG_LOG) console.log(`[rsthstartGrowthTimer] 成長開始 this._growingTimers`, this._growingTimers);
    };


    const _RSTH_GameSystem_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _RSTH_GameSystem_initialize.call(this);

        // RSTH 用の初期化処理をここに追加
        this._rsthGrowthTimers = [];      // 成長タイマー
        this.rsthLoadBlockDataFromDatabase();
    };


    //この行が即時関数の終わり

})();
