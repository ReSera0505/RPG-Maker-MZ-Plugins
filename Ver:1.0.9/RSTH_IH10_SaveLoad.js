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

        // ブロックデータをそのまま保存（副次ブロックも含めて全て保存）
        contents.survivalBlocks = window.RSTH_IH.SurvivalBlockManager._blocks.map(block => ({
            x: block.x,
            y: block.y,
            tileId: block.tileId,
            itemId: block.itemId,
            passable: (block.passable !== undefined) ? !!block.passable : true,
            growthStage: (block.growthStage !== undefined) ? block.growthStage : 0,
            _growthApplied: (block._growthApplied !== undefined) ? block._growthApplied : false,
            _isGrowthRoot: (block._isGrowthRoot !== undefined) ? block._isGrowthRoot : false,
            originX: (block.originX !== undefined) ? block.originX : null,
            originY: (block.originY !== undefined) ? block.originY : null,
            blockType: block.blockType || "ground" // ← ここを追加
        }));


        // ドロップアイテムを保存
        contents.survivalDrops = window.RSTH_IH.DropManager._drops.map(drop => {
            if (!drop.item || drop.item.id == null) return null;
            if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] drop.item", drop.item);

            // アイテムタイプを識別
            let type = "item";

            const dropitemType = window.RSTH_IH.getItemType(drop.item);
            type = dropitemType;



            return {
                x: drop.x,
                y: drop.y,
                id: drop.item.id,
                name: drop.item.name,
                iconIndex: drop.item.iconIndex,
                type: type,
                count: drop.item.count || 1
            };
        }).filter(e => e);

        // null除去

        if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] contents.survivalDrops", contents.survivalDrops);
        window.RSTH_IH.getBlocks_and_Spriteslist("makeSaveContents 完了");
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

        // セーブからブロック情報復元（originX / originY / blockType を必ず保持）
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
            originY: (typeof b.originY === "number") ? b.originY : null,
            blockType: (typeof b.blockType === "string") ? b.blockType : "ground" // ← blockType を復元
        }));

        // スプライトを初期化（描画は後で再構築）
        manager._sprites = [];

        // ★ 再描画フラグを設定：onMapLoaded内で updateGrowthSprites による再構築を促す
        window.RSTH_IH.__needGrowthSpriteUpdate = true;

        // ドロップデータ復元
        window.RSTH_IH.DropManager._drops = [];
        if (contents.survivalDrops) {

            if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] contents.survivalDrops", contents.survivalDrops);
            for (const d of contents.survivalDrops) {
                if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] d", d);
                let item = null;
                const dropitemType = window.RSTH_IH.getItemType(d);
                if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] dropitemType", dropitemType);
                if (dropitemType === "item") {
                    item = $dataItems[d.id];
                } else if (dropitemType === "weapon") {
                    item = $dataWeapons[d.id];
                } else if (dropitemType === "armor") {
                    item = $dataArmors[d.id];
                } else if (dropitemType === "tool") {
                    item = $dataWeapons[d.id];
                } else if (dropitemType === "block") {
                    item = $dataItems[d.id];
                }

                if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] item", item);
                if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] item.iconIndex", item.iconIndex);
                if (item && item.iconIndex != null) {
                    const dropItemData = Object.assign({}, item, {
                        count: d.count || 1,
                        type: d.itemType
                    });
                    const drop = new window.RSTH_IH.DroppedItem(d.x, d.y, dropItemData);
                    window.RSTH_IH.DropManager._drops.push(drop);
                } else if (RSTH_DEBUG_LOG) {
                    console.warn(`[extractSaveContents] Invalid id/type: ${d.id} (${dropitemType}), drop skipped.`);
                }
            }
        }


        if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] window.RSTH_IH.DropManager._drops", window.RSTH_IH.DropManager._drops);

        window.RSTH_IH.getBlocks_and_Spriteslist("extractSaveContents 完了");
        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] extractSaveContents 完了");
    };


    // ★ マップロード完了後にスプライトを生成
    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);
        window.RSTH_IH.getBlocks_and_Spriteslist("onMapLoaded_start");

        const manager = window.RSTH_IH?.SurvivalBlockManager;

        // 非window.RSTH_IH.GrowBlockでgrowthStage=1のブロックを強制修正
        if (manager && Array.isArray(manager._blocks)) {
            for (const block of manager._blocks) {
                const item = $dataItems[block.itemId];
                const blockType = item?.meta?.blockType || "";
                if (blockType !== window.RSTH_IH.GrowBlock && block.growthStage === 1) {
                    if (RSTH_DEBUG_LOG) {
                        console.warn(`[onMapLoaded] 非window.RSTH_IH.GrowBlockにgrowthStage=1が存在 → 強制リセット:`, block);
                    }
                    block.growthStage = 0;
                    if (typeof block._growthApplied !== "undefined") block._growthApplied = false;
                    if (typeof block._isGrowthRoot !== "undefined") block._isGrowthRoot = false;
                }
            }
        }

        // ドロップスプライト復元
        const drops = window.RSTH_IH.DropManager._drops || [];
        const tilemap = SceneManager._scene._spriteset._tilemap;

        for (const drop of drops) {
            if (!drop.item || drop.item.iconIndex == null) {
                if (RSTH_DEBUG_LOG) console.warn(`[onMapLoaded] Drop item invalid, skipping sprite:`, drop);
                continue;
            }

            // 既存スプライトがあれば tilemap から削除
            if (drop.sprite && drop.sprite.parent) {
                drop.sprite.parent.removeChild(drop.sprite);
                drop.sprite = null;
            }

            // スプライト再生成
            window.RSTH_IH.DropManager.createSprite(drop);
        }


        // 成長スプライトの更新（主に manager._sprites 再構築）
        if (manager?.updateGrowthSprites) {
            manager.updateGrowthSprites();
        }

        // スプライト再アタッチ処理（再生成せずに復元のみ）
        setTimeout(() => {
            const spriteset = SceneManager._scene._spriteset;
            const manager = window.RSTH_IH.SurvivalBlockManager;
            manager._sprites = [];

            const newBlocks = [];

            for (const block of manager._blocks) {
                const item = $dataItems[block.itemId];
                if (!item) continue;

                const tileOffsets2 = JSON.parse(item.meta.tileOffsets2 || "[]");

                const isExpandable =
                    block.growthStage === 1 &&
                    block._isGrowthRoot &&
                    block.blockType === window.RSTH_IH.GrowBlock &&
                    Array.isArray(tileOffsets2) &&
                    tileOffsets2.length > 0;

                if (isExpandable) {
                    for (const offset of tileOffsets2) {
                        const bx = block.x + (offset.dx || 0);
                        const by = block.y + (offset.dy || 0);

                        const newBlock = {
                            x: bx,
                            y: by,
                            tileId: Number(offset.tileId),
                            itemId: block.itemId,
                            passable: (typeof offset.passable === "boolean") ? offset.passable : true,
                            growthStage: 1,
                            _growthApplied: true,
                            _isGrowthRoot: (offset.dx === 0 && offset.dy === 0),
                            originX: block.originX ?? block.x,
                            originY: block.originY ?? block.y,
                            blockType: window.RSTH_IH.GrowBlock
                        };
                        newBlocks.push(newBlock);

                        const sprite = manager.addSprite(newBlock); // ★明示的に生成
                        if (sprite && sprite instanceof Sprite) {
                            spriteset.addChild(sprite); // ★再アタッチ
                            manager._sprites.push(sprite); // ★保存
                        }
                    }
                } else {
                    newBlocks.push(block);
                    const sprite = manager.addSprite(block);
                    if (sprite && sprite instanceof Sprite) {
                        spriteset.addChild(sprite); // ★再アタッチ
                        manager._sprites.push(sprite); // ★保存
                    }
                }
            }

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