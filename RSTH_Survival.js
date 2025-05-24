/*:
 * @target MZ
 * @plugindesc RSTH_Survival: ブロック設置＆破壊システム ver1.0.0
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
 * <tileId:1>
 * <blockName:土ブロック>
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
 * @param TilesetName
 * @text タイルセット画像名
 * @desc ブロック描画に使用するタイル画像のファイル名（img/tilesets/ 内）
 * @type file
 * @dir img/tilesets
 * @default Inside_C
 *
 */


(() => {
    "use strict";

    const p = PluginManager.parameters("RSTH_Survival");

    const TILESET_NAME = p["TilesetName"] || "Inside_C";

    const BLOCK_SIZE = 48;
    const COLS = 16;

    window.RSTH_IH = window.RSTH_IH || {};

    // ▼ 共通関数：スロット情報 → 実データ
    function getGameItem(item) {
        if (item.type === "item") return $dataItems[item.id];
        if (item.type === "weapon") return $dataWeapons[item.id];
        if (item.type === "armor") return $dataArmors[item.id];
        if (item.type === "block") return item;
        if (item.type === "tool") return $dataWeapons[item.id];
        return null;
    }

    class Game_SurvivalBlock {
        constructor(x, y, tileId) {
            this.x = x;
            this.y = y;
            this.tileId = tileId;
        }
    }

    // tileId → アイテムID のドロップ対応表
    const DropTable = {
        1: 2, // tileId 1（例：土ブロック） → $dataItems[2]（土アイテム）
        2: 3, // tileId 2（例：石ブロック） → $dataItems[3]（石アイテム）
        // 必要に応じて追加
    };


    class Sprite_SurvivalBlock extends Sprite {
        constructor(block) {
            super();
            this.block = block;
            this.bitmap = ImageManager.loadTileset(TILESET_NAME);
            this.anchor.x = 0;
            this.anchor.y = 0;
            this.updateFrame(); // ← frameだけOK
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
            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const ox = $gameMap.displayX() * tw;
            const oy = $gameMap.displayY() * th;
            this.x = this.block.x * tw - ox;
            this.y = this.block.y * th - oy;
        }

        updateFrame() {
            const id = this.block.tileId - 1;
            const col = id % COLS;
            const row = Math.floor(id / COLS);
            this.setFrame(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    window.RSTH_IH.SurvivalBlockManager = {
        _blocks: [],
        _sprites: [],

        place(x, y, tileId) {
            if (this.get(x, y)) return;
            const block = new Game_SurvivalBlock(x, y, tileId);
            this._blocks.push(block);

            if (SceneManager._scene instanceof Scene_Map && SceneManager._scene._spriteset) {
                this.addSprite(block); // ✅ 即時描画
            } else {
                //console.warn("⚠️ addSprite skipped: Scene not ready");
            }
        },

        break(x, y) {
            const index = this._blocks.findIndex(b => b.x === x && b.y === y);
            if (index >= 0) {
                const block = this._blocks[index];
                const tileId = block.tileId;

                this._blocks.splice(index, 1);
                this.removeSpriteAt(x, y);

                // ▼ ドロップ処理
                const dropItemId = DropTable[tileId];
                if (dropItemId && $dataItems[dropItemId]) {
                    DropManager.dropItem(x, y, $dataItems[dropItemId]);
                    //console.log(`💥 ブロック(${x},${y}) tileId=${tileId} を破壊 → itemId=${dropItemId} をドロップ`);
                }
            }
        }
        ,


        get(x, y) {
            return this._blocks.find(b => b.x === x && b.y === y);
        },

        addSprite(block) {
            //console.log("🔧 addSprite:", block);
            const sprite = new Sprite_SurvivalBlock(block);
            sprite.updatePosition(); // ← この位置で呼べばOK

            const spriteset = SceneManager._scene._spriteset;
            if (!spriteset) {
                //console.warn("⚠️ spriteset missing");
                return;
            }

            spriteset.addChild(sprite); // ✅ スプライトはカメラに固定だが、位置を逆算して追従させない
            //console.log("✅ sprite added to spriteset (fixed)");
            this._sprites.push(sprite);
        },

        removeSpriteAt(x, y) {
            const index = this._sprites.findIndex(s => s.block.x === x && s.block.y === y);
            if (index >= 0) {
                const sprite = this._sprites[index];
                const spriteset = SceneManager._scene._spriteset;
                if (spriteset) {
                    spriteset.removeChild(sprite);
                }
                this._sprites.splice(index, 1);
            }
        },

        clear() {
            this._blocks = [];
            this._sprites.forEach(sprite => {
                const spriteset = SceneManager._scene._spriteset;
                spriteset.removeChild(sprite);
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
        this.RSTH_IH_updateSurvivalPlacement();
        //this.updateSurvivalBreak();
        //this.useSelectedHotbarItem();
        DropManager.update();
    };

    function getBlockTileId(item) {
        return Number(item.meta.tileId || 0);
    }


    Scene_Map.prototype.RSTH_IH_updateSurvivalPlacement = function () {
        // クリックだけでは設置処理をしない（Input.isTriggered("ok") のみに限定）
        if (Input.isTriggered("ok")) {
            const item = this.getSelectedHotbarBlock();
            if (!item || !item.tileId) return;

            const [x, y] = getFrontTileXY();
            if (!window.RSTH_IH.SurvivalBlockManager.get(x, y)) {
                //console.log(`🟩 ブロック設置: (${x}, ${y}) → tileId ${item.tileId}`);
                window.RSTH_IH.SurvivalBlockManager.place(x, y, item.tileId);
                SoundManager.playOk(); // 音

                // 使用後の消費処理（InventoryHotbar.js側の useInventoryItem に移譲）
            }
        }
    };

    Scene_Map.prototype.getSelectedHotbarBlock = function () {
        const hotbar = SceneManager._scene._hotbarWindow;
        if (!hotbar || hotbar.selectedIndex < 0) return null;
        const item = hotbar.items[hotbar.selectedIndex];

        if (!item) return null;

        // 🔍 ブロックアイテムかどうか明確にチェック
        if (item.type === "block" && item.tileId > 0) {
            return item;
        }
        else if (item.type === "tool") {
            return item;
        }

        return null;
    };

    function isToolWeapon(item) {
        return DataManager.isWeapon(item) && item.meta.tool !== undefined;
    }

    function getEffectiveBlocks(item) {
        try {
            return JSON.parse(item.meta.blockEffective || "[]");
        } catch (e) {
            return [];
        }
    }

    function getBlockPower(item) {
        return Number(item.meta.blockPower || 0);
    }

    class DroppedItem {
        constructor(x, y, itemData) {
            this.x = x;
            this.y = y;
            this.item = itemData;
            this.sprite = null;
            this._collected = false;
            //console.log(`🆕 DroppedItem: (${x}, ${y}), item=${itemData.name}, collected=${this._collected}`);
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
            //console.log(`🎨 createSprite() for drop (${drop.x}, ${drop.y})`);
            const sprite = new Sprite();
            sprite.bitmap = ImageManager.loadSystem("IconSet");
            const iconIndex = drop.item.iconIndex;
            const sx = (iconIndex % 16) * 32;
            const sy = Math.floor(iconIndex / 16) * 32;
            sprite.setFrame(sx, sy, 32, 32);

            sprite.update = function () {
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();
                const ox = $gameMap.displayX() * tw;
                const oy = $gameMap.displayY() * th;
                this.x = drop.x * tw - ox + 8;
                this.y = drop.y * th - oy + 8;
            };

            SceneManager._scene._spriteset.addChild(sprite);
            drop.sprite = sprite;
        }
        ,

        update() {
            const px = $gamePlayer.x;
            const py = $gamePlayer.y;

            for (let i = this._drops.length - 1; i >= 0; i--) {
                const drop = this._drops[i];

                if (!drop) {
                    //console.warn(`⚠️ drop is null at index ${i}`);
                    continue;
                }

                if (!drop.item) {
                    //console.warn(`⚠️ drop.item is null at (${drop.x}, ${drop.y})`);
                    continue;
                }

                if (drop._collected) {
                    //console.log(`🔁 skip: already collected (${drop.x},${drop.y})`);
                    continue;
                }

                const dx = drop.x - px;
                const dy = drop.y - py;
                const dist = Math.abs(dx) + Math.abs(dy);

                if (dist <= 1) {
                    //console.log(`💡 回収可能距離に入りました (${drop.x},${drop.y}) → dist=${dist}`);
                    const success = window.RSTH_IH.gainItemToInventoryThenHotbar(drop.item, drop.item.count || 1);
                    //console.log(`📥 gainItem success=${success}`);
                    if (success) {
                        drop._collected = true;
                        //console.log(`✅ _collected フラグを true に設定: (${drop.x}, ${drop.y})`);
                        this.remove(drop);
                        //console.log(`🧹 remove() 実行: (${drop.x}, ${drop.y})`);
                    } else {
                        //console.warn(`🚫 gainItem failed: (${drop.x}, ${drop.y})`);
                    }
                }
            }
        }

        ,

        remove(drop) {
            //console.log(`🗑️ remove() called for (${drop.x}, ${drop.y})`);
            if (!drop) return;
            if (drop.sprite && SceneManager._scene && SceneManager._scene._spriteset) {
                SceneManager._scene._spriteset.removeChild(drop.sprite);
                //console.log(`🖼️ sprite removed from scene`);
                drop.sprite = null;
            }
            const index = this._drops.indexOf(drop);
            if (index >= 0) {
                this._drops.splice(index, 1);
                //console.log(`📦 drop removed from _drops[]`);
            } else {
                // console.warn(`❓ drop not found in _drops[]`);
            }
        }



    };

    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const contents = _DataManager_makeSaveContents.call(this);
        contents.survivalBlocks = window.RSTH_IH.SurvivalBlockManager._blocks;
        contents.droppedItems = DropManager._drops.map(drop => ({
            x: drop.x,
            y: drop.y,
            item: drop.item,
            collected: drop._collected // ✅ フラグも保存
        }));

        return contents;
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _DataManager_extractSaveContents.call(this, contents);
        window.RSTH_IH.SurvivalBlockManager._blocks = contents.survivalBlocks || [];
        DropManager._drops = (contents.droppedItems || []).map(d => {
            const drop = new DroppedItem(d.x, d.y, d.item);
            drop._collected = d.collected || false;
            return drop;
        });


    };

    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);

        window.RSTH_IH.SurvivalBlockManager._sprites = []; // ← 念のためリセット
        for (const block of window.RSTH_IH.SurvivalBlockManager._blocks) {
            window.RSTH_IH.SurvivalBlockManager.addSprite(block);
        }

        for (const drop of DropManager._drops) {
            if (!drop._collected) {
                DropManager.createSprite(drop);
            }
        }

    };

    function isPlaceableBlockItem(item) {
        return DataManager.isItem(item) && item.meta.block !== undefined && item.meta.tileId !== undefined;
    }

    function getBlockTileId(item) {
        return Number(item.meta.tileId || 0);
    }

    // RPGツクールのアイテムからホットバー用のデータに変換
    function createHotbarBlockItem(item, count = 1) {
        if (!isPlaceableBlockItem(item)) return null;
        //console.log("createHotbarBlockItem:", item.meta.tileId, getBlockTileId(item));

        return {
            id: item.id,
            name: item.meta.blockName || item.name,
            iconIndex: item.iconIndex,
            type: "block",
            tileId: getBlockTileId(item),
            count
        };
    }

    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);

        window.RSTH_IH.SurvivalBlockManager._blocks = [];
        window.RSTH_IH.SurvivalBlockManager._sprites = [];

        DropManager._drops = [];

        //console.log("🧹 ニューゲーム：window.RSTH_IH.SurvivalBlockManager / DropManager を初期化");
    };


    const _Game_Map_isPassable = Game_Map.prototype.isPassable;
    Game_Map.prototype.isPassable = function (x, y, d) {
        if (window.RSTH_IH.SurvivalBlockManager.get(x, y)) {
            // ブロックが存在する場合は通行不可にする
            return false;
        }
        return _Game_Map_isPassable.call(this, x, y, d);
    };

    Scene_Map.prototype.useSelectedHotbarItem = function () {
        const item = this.getSelectedHotbarBlock();
        if (!item) return;

        const gameItem = getGameItem(item);
        if (isToolWeapon(gameItem)) {
            const [x, y] = getFrontTileXY();
            const block = window.RSTH_IH.SurvivalBlockManager.get(x, y);
            if (!block) return;

            const effective = getEffectiveBlocks(gameItem);
            if (!effective.includes(block.tileId)) return;

            window.RSTH_IH.SurvivalBlockManager.break(x, y);
            SoundManager.playEnemyCollapse();
            console.log(`🪓 ブロック破壊: (${x}, ${y}) by ${item.name}`);
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
