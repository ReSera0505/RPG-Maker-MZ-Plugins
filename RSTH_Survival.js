/*:
 * @target MZ
 * @plugindesc RSTH_Survival: ブロック設置＆破壊システム ver1.0.1
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
 * <tileId:3>
 * <blockName:高級椅子>
 * <size:[1,3]>
 * <tileset:Inside_C>
 * <blockZ:under>
 * <tileOffsets:[
 *   {"dx":0,"dy":0,"tileId":3,"passable":false},
 *   {"dx":0,"dy":1,"tileId":3,"passable":false},
 *   {"dx":0,"dy":2,"tileId":19,"passable":true}
 * ]>
 * 以上がメモ欄へ記載するメタタグ。
 * tileIdはタイルセットのcols（1行に何個タイルがあるか）に影響されます。
 * colsが16の場合、1行目はtileId:1で、2行目はtileId:17となります。
 * colsはプラグインパラメータで変更が可能です。
 * 
 * <blockZ:>はunderでプレイヤーより下層、overでプレイヤーより上層に
 * 表示されるようになります。
 * 
 * <tileOffsets:>はどのマスにどのtileIdを表示するかの指定、
 * passableはtrueで通行可能、falseで通行不可能の指定が可能です。
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
 * プロジェクトの「js/plugins」フォルダにこのファイルを追加し、
 * プラグインマネージャーから有効にしてください。 
 * 
 * ----------------------------
 * 変更履歴:
 * ----------------------------
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


    // tileId → アイテムID のドロップ対応表
    const DropTable = {
        1: 2, // tileId 1（例：土ブロック） → $dataItems[2]（土アイテム）
        2: 3, // tileId 2（例：石ブロック） → $dataItems[3]（石アイテム）
        3: 4,
        // 必要に応じて追加
    };

    class Sprite_SurvivalBlock extends Sprite {
        constructor(block) {
            super();
            const item = $dataItems[block.itemId];
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




    window.RSTH_IH.SurvivalBlockManager = {
        _blocks: [],
        _sprites: [],

        place(x, y, itemId) {
            const item = $dataItems[itemId];
            if (!item || !item.meta || !item.meta.tileOffsets) return;

            let tileOffsets = [];
            try {
                tileOffsets = JSON.parse(item.meta.tileOffsets);
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
                    originY: y
                };

                this._blocks.push(block);
                if (SceneManager._scene instanceof Scene_Map) {
                    this.addSprite(block);
                }
            }
        }

        ,

        break(x, y) {
            let target = this.get(x, y);

            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][break] ????`);
            if (!target) return;

            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][break] (target? ${target}`);

            // origin 情報の取得
            const originX = target.originX ?? target.x;
            const originY = target.originY ?? target.y;

            if (RSTH_DEBUG_LOG) console.log(`[SurvivalBlockManager][break] (originX? ${originX} originY? ${originY} `);
            // origin の実体（スプライトやtileIdのため）を取得
            const originBlock = this.get(originX, originY);

            // 対象ブロックをまとめて取得（すべて削除するため）
            const toRemove = this._blocks.filter(b =>
                b.originX === originX && b.originY === originY
            );

            // ドロップ処理は originBlock の tileId に基づく
            if (originBlock) {
                const dropItemId = DropTable[originBlock.tileId];
                if (dropItemId && $dataItems[dropItemId]) {
                    DropManager.dropItem(originX, originY, $dataItems[dropItemId]);
                }
            }

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


        addSprite(block) {
            const item = $dataItems[block.itemId];
            const tilesetName = item?.meta?.tileset || TILESET_NAME;
            const cfg = getTilesetConfigByName(tilesetName);
            const tileSize = cfg.tileSize;
            const cols = cfg.cols;

            const sprite = new Sprite_SurvivalBlock(block);

            sprite.bitmap = ImageManager.loadTileset(tilesetName);

            const id = block.tileId - 1;
            const col = id % cols;
            const row = Math.floor(id / cols);
            sprite.setFrame(col * tileSize, row * tileSize, tileSize, tileSize);

            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const ox = $gameMap.displayX() * tw;
            const oy = $gameMap.displayY() * th;
            sprite.x = block.x * tw - ox;
            sprite.y = block.y * th - oy;

            const blockZ = item?.meta?.blockZ || "over";
            sprite.z = blockZ === "under" ? 0 : blockZ === "over" ? 10 : 5;

            sprite.block = block;

            const spriteset = SceneManager._scene._spriteset;
            if (spriteset && spriteset._tilemap) {
                spriteset._tilemap.addChild(sprite);
                this._sprites.push(sprite);
            }
        }
        ,

        removeSpriteAt(x, y) {
            const index = this._sprites.findIndex(s => s.block.x === x && s.block.y === y);
            if (index >= 0) {
                const sprite = this._sprites[index];
                const spriteset = SceneManager._scene._spriteset;
                if (spriteset && spriteset._tilemap && sprite) {
                    spriteset._tilemap.removeChild(sprite);
                }
                this._sprites.splice(index, 1);
            }
        }

        ,

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



    function getFrontTileXY() {
        const dir = $gamePlayer.direction();
        const x = $gamePlayer.x + (dir === 6 ? 1 : dir === 4 ? -1 : 0);
        const y = $gamePlayer.y + (dir === 2 ? 1 : dir === 8 ? -1 : 0);
        return [x, y];
    }

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        DropManager.update();
    };

    //1秒間（約60フレーム）再試行しない処理
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


    const DropManager = {
        _drops: [],

        dropItem(x, y, itemData) {
            const drop = new DroppedItem(x, y, itemData);
            drop._collected = false;
            this._drops.push(drop);
            this.createSprite(drop);
        }
        ,

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

    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const contents = _DataManager_makeSaveContents.call(this);
        contents.survivalBlocks = window.RSTH_IH.SurvivalBlockManager._blocks;
        contents.survivalDrops = DropManager._drops.map(drop => {
            if (!drop.item || drop.item.id == null) return null;
            return {
                x: drop.x,
                y: drop.y,
                itemId: drop.item.id
            };
        }).filter(e => e); // ← null除去

        return contents;
    };



    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _DataManager_extractSaveContents.call(this, contents);

        const manager = window.RSTH_IH.SurvivalBlockManager;
        manager._blocks = contents.survivalBlocks || [];
        manager._sprites = [];
        for (const block of manager._blocks) {
            manager.addSprite(block);
        }

        DropManager._drops = [];
        if (contents.survivalDrops) {
            for (const d of contents.survivalDrops) {
                const item = $dataItems[d.itemId];
                if (item && item.iconIndex != null) {
                    DropManager._drops.push(new DroppedItem(d.x, d.y, item));
                } else {
                    if (RSTH_DEBUG_LOG) {
                        console.warn(`[extractSaveContents] Invalid itemId: ${d.itemId}, drop skipped.`);
                    }
                }

            }
        }

    };



    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);

        const manager = window.RSTH_IH.SurvivalBlockManager;
        manager._sprites = [];
        if (RSTH_DEBUG_LOG) console.log(`[onMapLoaded] blocks count: ${manager._blocks.length}`);
        for (const block of manager._blocks) {
            if (RSTH_DEBUG_LOG) console.log(`[onMapLoaded] addSprite for block (${block.x}, ${block.y})`);
            manager.addSprite(block);
        }


        // ドロップアイテムのスプライトを再表示
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


    };




    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);

        window.RSTH_IH.SurvivalBlockManager._blocks = [];
        window.RSTH_IH.SurvivalBlockManager._sprites = [];

        DropManager._drops = [];

        if (RSTH_DEBUG_LOG) console.log("[_DataManager_setupNewGame]ニューゲーム：window.RSTH_IH.SurvivalBlockManager / DropManager を初期化");
    };


    const _Game_Map_isPassable = Game_Map.prototype.isPassable;
    Game_Map.prototype.isPassable = function (x, y, d) {
        const block = window.RSTH_IH.SurvivalBlockManager.get(x, y);
        if (block) {
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
                    originY: y
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





})();
