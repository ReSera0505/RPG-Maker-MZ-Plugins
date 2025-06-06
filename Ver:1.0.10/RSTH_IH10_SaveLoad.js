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

        if (mgr && typeof mgr.updateSpriteRefreshQueue === "function") {
            mgr.updateSpriteRefreshQueue(); // ★ スプライト再描画予約を処理
        }




        if ($gameSystem.rsthupdateGrowthTimers) {
            $gameSystem.rsthupdateGrowthTimers();
        }
        window.RSTH_IH.DropManager.update();

        // メッセージ中は独自カーソル非表示にする
        if (this._rsthCursorSprite) {
            this._rsthCursorSprite.visible = !$gameMessage.isBusy();
        }

        const px = $gamePlayer.x;
        const py = $gamePlayer.y;
        mgr.update(px, py);
    };




    // ★ セーブ内容にブロックとドロップデータを追加
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const contents = _DataManager_makeSaveContents.call(this);
        if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] セーブデータ作成開始");

        // ブロックマップを再構築
        const manager = window.RSTH_IH.SurvivalBlockManager;
        if (manager?.rebuildBlockMap) manager.rebuildBlockMap();

        const blocks = manager._blocks;
        const bulkMap = new Map();  // itemId → [{x, y}, ...]
        const uniqueList = [];




        for (const block of blocks) {
            if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] block", block);
            const offsets = block.originalOffsets;
            if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] offsets", offsets);
            if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] offsets.length", offsets.length);
            const isUnique =
                typeof block.hp === "number" && !isNaN(block.hp) ||
                block.growthTime > 0 ||
                block.growthStage !== 0 ||
                block._growthApplied === true ||
                block._isGrowthRoot === true ||
                offsets.length > 1;
            if (isUnique) {
                uniqueList.push({ ...block });
            } else {
                if (!bulkMap.has(block.itemId)) bulkMap.set(block.itemId, []);
                bulkMap.get(block.itemId).push({ x: block.x, y: block.y });
            }
        }

        // バルク形式に変換
        const bulkArray = [];
        for (const [itemId, positions] of bulkMap.entries()) {
            bulkArray.push({ itemId, positions });
        }

        // 結果を保存
        contents.survivalBlocksBulk = bulkArray;
        contents.survivalBlocksUnique = uniqueList;

        // ★ ログ出力
        if (RSTH_DEBUG_LOG) {
            console.log(`[makeSaveContents] バルクブロック数: ${bulkArray.reduce((a, b) => a + b.positions.length, 0)} 種類: ${bulkArray.length}`);
            console.log(`[makeSaveContents] ユニークブロック数: ${uniqueList.length}`);
            console.table("[makeSaveContents] bulkArray", bulkArray);
            console.table("[makeSaveContents] uniqueList", uniqueList);
        }

        // ドロップも保存（省略可）
        contents.survivalDrops = window.RSTH_IH.DropManager?._drops?.map(drop => {
            if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] drop", drop);
            if (!drop.item || drop.item.id == null) return null;
            return {
                x: drop.x,
                y: drop.y,
                id: drop.item.id,
                name: drop.item.name,
                iconIndex: drop.item.iconIndex,
                type: window.RSTH_IH.getItemType(drop.item),
                count: drop.item.count || 1
            };
        }).filter(e => e);

        if (RSTH_DEBUG_LOG) console.log("[makeSaveContents] セーブデータ作成終了");
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

        if (RSTH_DEBUG_LOG) console.log("[extractSaveContents]  実行開始");

        const manager = window.RSTH_IH.SurvivalBlockManager;

        // ブロック定義データを再ロード（ロードデータと干渉する場合はコメントアウト可能）
        if (typeof manager.rsthLoadBlockDataFromDatabase === "function") {
            manager.rsthLoadBlockDataFromDatabase();
        }

        // ブロック情報復元
        const restoredBlocks = [];

        // ▼ 圧縮形式のブロック（シンプル）
        if (Array.isArray(contents.survivalBlocksBulk)) {
            for (const bulk of contents.survivalBlocksBulk) {
                const itemId = bulk.itemId;
                const item = $dataItems[itemId];
                if (!item) continue;

                // tileId を tileOffsets1Parsed から取得
                let tileId = 0;
                let passable = true;
                const offsets = item._tileOffsets1Parsed;
                if (Array.isArray(offsets)) {
                    const mainTile = offsets.find(t => t.dx === 0 && t.dy === 0);
                    if (mainTile && typeof mainTile.tileId === "number") {
                        tileId = mainTile.tileId;
                    }
                    if (mainTile) {
                        if (typeof mainTile.passable === "boolean") {
                            passable = mainTile.passable;
                        } else if (typeof mainTile.passable === "string") {
                            passable = mainTile.passable === "true";
                        }
                    }
                }

                const blockType = item.meta?.blockType || "ground";

                const blockHP = Number(item.meta?.blockHP ?? 1); // blockHPが無いときは1
                const originalOffsets = offsets;

                if (RSTH_DEBUG_LOG) console.table("[extractSaveContents]  item", item);
                for (const pos of bulk.positions) {

                    restoredBlocks.push({
                        x: pos.x,
                        y: pos.y,
                        tileId,
                        itemId,
                        blockHP,
                        hp: null,
                        passable,
                        originX: pos.x,
                        originY: pos.y,
                        growthStage: 0,
                        growthTime: 0,
                        _growthApplied: false,
                        _isGrowthRoot: false,
                        originalOffsets,
                        blockType
                    });
                }
            }
        }

        // ▼ ユニークブロック
        if (Array.isArray(contents.survivalBlocksUnique)) {
            for (const b of contents.survivalBlocksUnique) {
                const itemId = b.itemId;
                const item = $dataItems[itemId];
                const blockHP = item ? Number(item.meta?.blockHP ?? 1) : 1;
                const hp = b.hp ?? null;

                if (RSTH_DEBUG_LOG) console.table("[extractSaveContents]  b", b);
                restoredBlocks.push({
                    x: b.x,
                    y: b.y,
                    tileId: b.tileId,
                    itemId: b.itemId,
                    blockHP,
                    hp,
                    passable: typeof b.passable === "boolean" ? b.passable : true,
                    originX: typeof b.originX === "number" ? b.originX : b.x,
                    originY: typeof b.originY === "number" ? b.originY : b.y,
                    growthStage: b.growthStage ?? 0,
                    growthTime: typeof b.growthTime === "number" ? b.growthTime : 0,
                    _growthApplied: b._growthApplied ?? false,
                    _isGrowthRoot: b._isGrowthRoot ?? false,
                    originalOffsets: b.originalOffsets,
                    blockType: typeof b.blockType === "string" ? b.blockType : "ground",
                    hp: typeof b.hp === "number" ? b.hp : null
                });
            }
        }

        manager._blocks = restoredBlocks;

        // ブロックマップ再構築
        if (typeof manager.rebuildBlockMap === "function") {
            manager.rebuildBlockMap();
        }

        // スプライト初期化（後で再描画される）
        manager._sprites = [];

        // 成長ブロック再描画フラグ
        window.RSTH_IH.__needGrowthSpriteUpdate = true;

        // ▼ ドロップデータ復元
        window.RSTH_IH.DropManager._drops = [];
        if (contents.survivalDrops) {
            if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] contents.survivalDrops", contents.survivalDrops);
            for (const d of contents.survivalDrops) {
                if (RSTH_DEBUG_LOG) console.log("[extractSaveContents] d", d);
                let item = null;
                const dropitemType = window.RSTH_IH.getItemType(d);
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
        if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("extractSaveContents 完了");
        if (RSTH_DEBUG_LOG) console.log("[RSTH DEBUG] extractSaveContents 完了");
    };



    // ★ マップロード完了後にスプライトを生成
    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);
        if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("onMapLoaded_start");

        const manager = window.RSTH_IH?.SurvivalBlockManager;

        // 非window.RSTH_IH.GrowBlockでgrowthStage=1のブロックを強制修正
        if (manager && Array.isArray(manager._blocks)) {
            for (const block of manager._blocks) {
                const item = $dataItems[block.itemId];
                const blockType = item?.meta?.blockType || "";
                if (blockType !== window.RSTH_IH.GrowBlock && block.growthStage === 1) {
                    if (RSTH_DEBUG_LOG) console.warn(`[onMapLoaded] 非window.RSTH_IH.GrowBlockにgrowthStage=1が存在 → 強制リセット:`, block);
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
            const manager = window.RSTH_IH.SurvivalBlockManager;
            if (!manager) return;

            manager._sprites = [];
            manager._spriteAddQueue = [];
            manager._loadedChunks = new Set();

            const newBlocks = [];

            for (const block of manager._blocks) {
                const item = $dataItems[block.itemId];
                if (!item) continue;

                let isLargeBlock = false;
                try {
                    const size = JSON.parse(item.meta.size || "[1,1]");
                    if (Array.isArray(size) && (size[0] >= 2 || size[1] >= 2)) {
                        isLargeBlock = true;
                    }
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn("[size判定] sizeメタタグのパース失敗", item.meta.size, e);
                }

                const tileOffsets2 = item._tileOffsets2Parsed || [];

                const isExpandable2 =
                    block.growthStage === 1 &&
                    block._isGrowthRoot &&
                    block.blockType === window.RSTH_IH.GrowBlock &&
                    Array.isArray(tileOffsets2) &&
                    tileOffsets2.length > 0;

                if (RSTH_DEBUG_LOG) console.log("[setTimeout] tileOffsets2", tileOffsets2, "isExpandable2", isExpandable2);

                if (isExpandable2) {
                    for (const offset of tileOffsets2) {
                        const bx = block.x + (offset.dx || 0);
                        const by = block.y + (offset.dy || 0);
                        const originX = block.originX ?? block.x;
                        const originY = block.originY ?? block.y;

                        // 🔽ここで重複チェック
                        const existsSameOrigin = manager._blocks.some(b =>
                            !(b.x === block.x && b.y === block.y) && // 本体ブロックは除外
                            b.x === bx && b.y === by &&
                            b.originX === originX &&
                            b.originY === originY
                        );
                        if (existsSameOrigin) {
                            if (RSTH_DEBUG_LOG) console.warn(`[onMapLoaded] 副次ブロックの重複を検出 → 展開スキップ (${bx},${by})`);
                            continue;
                        }

                        if (RSTH_DEBUG_LOG) console.log("[setTimeout] block", block);
                        const newBlock = {
                            x: bx,
                            y: by,
                            tileId: Number(offset.tileId),
                            itemId: block.itemId,
                            blockHP: Number(block.blockHP || 0),
                            hp: block.hp ?? null,
                            passable: (typeof offset.passable === "boolean") ? offset.passable : true,
                            originX: block.originX ?? block.x,
                            originY: block.originY ?? block.y,
                            growthStage: 1,
                            _growthApplied: true,
                            _isGrowthRoot: (offset.dx === 0 && offset.dy === 0),
                            originalOffsets: tileOffsets2,
                            blockType: window.RSTH_IH.GrowBlock
                        };
                        newBlocks.push(newBlock);
                        manager.addSprite(newBlock, false);
                    }
                } else {
                    newBlocks.push(block);
                    manager.addSprite(block, false);
                    if (RSTH_DEBUG_LOG) console.log("[setTimeout] block", block);
                    if (RSTH_DEBUG_LOG) console.log("[setTimeout] newBlocks", newBlocks);
                }

            }

            if (RSTH_DEBUG_LOG) console.log("[setTimeout] newBlocks_2", newBlocks);
            manager._blocks = newBlocks;

            // ブロックマップ再構築
            if (typeof manager.rebuildBlockMap === "function") {
                manager.rebuildBlockMap();
            }


            // 描画はチャンク処理に任せる（プレイヤー位置に基づいて分割描画）
            const px = $gamePlayer.x;
            const py = $gamePlayer.y;
            manager.update(px, py);
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

    // $dataItems ロード後にキャッシュする処理
    const _DataManager_rsthonLoad = DataManager.onLoad;
    DataManager.onLoad = function (object) {
        _DataManager_rsthonLoad.call(this, object);

        if (object === $dataItems) {
            for (const item of $dataItems) {
                if (!item || !item.meta) continue;

                // tileOffsets1 をキャッシュ
                if (item.meta.tileOffsets1 && !item._tileOffsets1Parsed) {
                    try {
                        item._tileOffsets1Parsed = JSON.parse(item.meta.tileOffsets1);
                    } catch (e) {
                        console.warn(`[tileOffsets1キャッシュ失敗] itemId=${item.id}`, e);
                        item._tileOffsets1Parsed = [];
                    }
                }

                // tileOffsets2 をキャッシュ
                if (item.meta.tileOffsets2 && !item._tileOffsets2Parsed) {
                    try {
                        item._tileOffsets2Parsed = JSON.parse(item.meta.tileOffsets2);
                    } catch (e) {
                        console.warn(`[tileOffsets2キャッシュ失敗] itemId=${item.id}`, e);
                        item._tileOffsets2Parsed = [];
                    }
                }
            }
        }
    };

})();