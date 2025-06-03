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
    // その他処理===============================================================================================
    //=============================================================================================================

    // init処理
    const _RSTH_GameSystem_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _RSTH_GameSystem_initialize.call(this);
        const maxInv = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows;
        const maxHot = window.RSTH_IH.HotbarSlotCount;
        this._customInventoryItems = Array(maxInv).fill(null);
        this._customHotbarItems = Array(maxHot).fill(null);
        // RSTH 用の初期化処理をここに追加
        this._growingTimers = [];
        this.rsthLoadBlockDataFromDatabase();
    };

    //update処理
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        this.updateMousePointerSprite();
        this.RSTH_IH_updateToggleEquipmentWindow();
        window.RSTH_IH.onLeftButtonDown();

        const mgr = window.RSTH_IH.SurvivalBlockManager;

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
        window.RSTH_IH.DropManager.update();

        // メッセージ中は独自カーソル非表示にする
        if (this._rsthCursorSprite) {
            this._rsthCursorSprite.visible = !$gameMessage.isBusy();
        }
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
        contents.survivalDrops = window.RSTH_IH.DropManager._drops.map(drop => {
            if (!drop.item || drop.item.id == null) return null;
            return {
                x: drop.x,
                y: drop.y,
                itemId: drop.item.id
            };
        }).filter(e => e); // null除去


        return contents;
    };

    // ★ サバイバルマネージャ初期化
    window.RSTH_IH.SurvivalBlockManager = window.RSTH_IH.SurvivalBlockManager || {};

    const SurvivalBlockManager = window.RSTH_IH.SurvivalBlockManager;

    SurvivalBlockManager.rsthLoadBlockDataFromDatabase = function () {
        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] rsthLoadBlockDataFromDatabase 開始");

        if (!$dataItems) {
            if (RSTH_DEBUG_LOG) console.warn("[RSTH DEBUG] $dataItems が未定義のため中止");
            return;
        }

        this._blockMetaList = [];
        for (const item of $dataItems) {
            if (item && item.meta && Boolean(item.meta.block)) {
                this._blockMetaList.push(item);
                if (RSTH_DEBUG_LOG) console.log(`[RSTH DEBUG] 登録: itemId=${item.id}, name=${item.name}`);
            }
        }

        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] rsthLoadBlockDataFromDatabase 完了: 登録件数 =", this._blockMetaList.length);
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
        window.RSTH_IH.DropManager._drops = [];
        if (contents.survivalDrops) {
            for (const d of contents.survivalDrops) {
                const item = $dataItems[d.itemId];
                if (item && item.iconIndex != null) {
                    window.RSTH_IH.DropManager._drops.push(new window.RSTH_IH.DroppedItem(d.x, d.y, item));
                } else if (RSTH_DEBUG_LOG) {
                    console.warn(`[extractSaveContents] Invalid itemId: ${d.itemId}, drop skipped.`);
                }
            }
        }

        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] extractSaveContents 完了");
    };

    // ★ マップロード完了後にスプライトを生成
    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);

        const manager = window.RSTH_IH?.SurvivalBlockManager;

        // ドロップスプライト復元
        for (const drop of window.RSTH_IH.DropManager._drops) {
            if (!drop.item || drop.item.iconIndex == null) {
                if (RSTH_DEBUG_LOG) console.warn(`[onMapLoaded] Drop item invalid, skipping sprite:`, drop);
                continue;
            }
            if (drop.sprite) {
                SceneManager._scene._spriteset.removeChild(drop.sprite);
                drop.sprite = null;
            }
            window.RSTH_IH.DropManager.createSprite(drop);
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


    };

    // ニューゲーム処理
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);

        window.RSTH_IH.SurvivalBlockManager._blocks = [];
        window.RSTH_IH.SurvivalBlockManager._sprites = [];

        window.RSTH_IH.DropManager._drops = [];

        if (RSTH_DEBUG_LOG) console.log("[_DataManager_setupNewGame]ニューゲーム：window.RSTH_IH.SurvivalBlockManager / window.RSTH_IH.DropManager を初期化");
    };

})();