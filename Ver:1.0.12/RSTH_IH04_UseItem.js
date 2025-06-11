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

    // ▼ アイテム使用処理
    window.RSTH_IH.useInventoryItem = function (item, source = "inventory", slotIndex = null, targetPos = null) {
        const scene = SceneManager._scene;
        const inv = scene?._inventoryWindow;
        const hotbar = scene?._hotbarWindow;
        if (!item) return;

        const dataItem = window.RSTH_IH.getGameItem(item);
        if (!dataItem) return;

        const actor = $gameParty.leader();

        if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]item.type: ${item.type}`);


        // ▼ ブロックなら設置処理
        if (item.type === "block") {
            const tileId = Number(item.tileId || 0);

            const tileX = targetPos?.x;
            const tileY = targetPos?.y;

            if (tileId > 0) {
                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]item`, item);
                const gameItem = window.RSTH_IH.getGameItem(item);

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]gameItem`, gameItem);
                // tileOffsets1をJSONとしてパース
                let tileOffsets = [];
                try {
                    tileOffsets = gameItem._tileOffsets1Parsed || [];
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]tileOffsets`, tileOffsets);
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]tileOffsets1 parse error`, e);
                    return; // パースエラー時は設置しない
                }

                if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]tileOffsets`, tileOffsets);

                // ブロックが未設置の場合のみ設置
                if (window.RSTH_IH.canPlaceBlockAt(tileX, tileY, gameItem)) {
                    const itemId = item.id;
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]ブロック設置: (${tileX}, ${tileY}) → tileId ${tileId}, itemId ${itemId}`);

                    // ブロック設置
                    window.RSTH_IH.SurvivalBlockManager.place(tileX, tileY, itemId);

                    // ブロックがチェストの場合
                    if (gameItem.meta.blockType === "chest") {
                        if (RSTH_DEBUG_LOG) console.warn(`[useInventoryItem]chest`);
                        try {
                            const chestsize = JSON.parse(gameItem.meta.chestsize || "[1,1]");
                            if (Array.isArray(chestsize)) {
                                window.RSTH_IH.ChestManager.addChest(tileX, tileY, chestsize[0], chestsize[1]);
                            }
                        } catch (e) {
                            if (RSTH_DEBUG_LOG) console.warn("[useInventoryItem]gameItem.meta.chestsizeメタタグのパース失敗", gameItem.meta.chestsize, e);
                        }

                        if (RSTH_DEBUG_LOG) console.warn(`[useInventoryItem]window.RSTH_IH.ChestManager._chests`, window.RSTH_IH.ChestManager._chests);
                    }

                    // その座標にあるすべてのブロックを取得
                    const placedBlocks = window.RSTH_IH.SurvivalBlockManager.getAll(tileX, tileY);

                    // blockType が "plant" のブロックのみに処理
                    for (const block of placedBlocks) {
                        const item = $dataItems[block.itemId];
                        const blockType = item?.meta?.blockType || "";
                        const growthTime = Number(item?.meta?.growthTime || 0);

                        if (growthTime > 0 && blockType === window.RSTH_IH.GrowBlock) {
                            block.growthTime = growthTime;
                            $gameSystem.rsthstartGrowthTimer(block.x, block.y, growthTime);
                            if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem] 成長タイマー登録: (${block.x},${block.y}) growthTime=${growthTime}`);
                        }
                    }



                    // ▼ アイテム1個消費処理
                    const list = (source === "inventory")
                        ? scene?._inventoryWindow?.items
                        : scene?._hotbarWindow?.items;

                    const index = slotIndex ?? list?.findIndex(slot =>
                        slot && slot.id === item.id && slot.type === item.type
                    );

                    if (index >= 0 && list?.[index]) {
                        const slot = list[index];

                        if (slot.count > 1) {
                            slot.count--;
                        } else {
                            list[index] = null;
                        }

                        // ▼ 表示更新
                        if (source === "inventory") {
                            $gameSystem._customInventoryItems = list;
                            scene?._inventoryWindow?.refresh();
                        } else if (source === "hotbar") {
                            $gameSystem._customHotbarItems = list;
                            scene?._hotbarWindow?.setItems(list);
                        }
                    }

                    return;
                } else {
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]設置不可: (${tileX}, ${tileY}) にはすでにブロックが存在`);
                    return;
                }
            }
        }


        if (item.type === "tool") {
            const gameItem = window.RSTH_IH.getGameItem(item);
            if (window.RSTH_IH.isToolWeapon(gameItem)) {
                const mapX = $gameMap.canvasToMapX(TouchInput.x);
                const mapY = $gameMap.canvasToMapY(TouchInput.y);


                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][tool]mapX ${mapX} mapY ${mapY}`);

                const block = window.RSTH_IH.SurvivalBlockManager.get(mapX, mapY);

                if (!block) {
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][tool]block is null or undifined`);
                    return;
                }

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][tool]block?`, block);


                const originX = block.originX ?? block.x;
                const originY = block.originY ?? block.y;
                const originBlock = window.RSTH_IH.SurvivalBlockManager.get(originX, originY);
                if (!originBlock) return;

                const effective = window.RSTH_IH.getEffectiveBlocks(gameItem);
                if (!effective.includes(originBlock.blockType)) return;

                // 安全に origin から破壊
                window.RSTH_IH.SurvivalBlockManager.break(originX, originY);

                //SoundManager.playEnemyCollapse();
                return;
            }
        }

        // 武器か防具なら装備処理（アイテム使用ではなく）
        if (DataManager.isArmor(dataItem) || DataManager.isWeapon(dataItem)) {
            if (DataManager.isWeapon(dataItem) && !window.RSTH_IH.EnableWeaponEquip) return; // ← 武器装備をできなくした場合はreturnする
            const list = (source === "inventory")
                ? $gameSystem._customInventoryItems
                : $gameSystem._customHotbarItems;

            if (typeof slotIndex !== "number") return;
            const index = slotIndex;
            if (index < 0) return;

            const slot = list[index];
            if (!slot) return;

            const actor = $gameParty.leader();
            if (!actor.canEquip(dataItem)) return;

            const slotId = actor.equipSlots().findIndex(etypeId => etypeId === dataItem.etypeId);
            if (slotId === -1) return;

            const removed = actor.equips()[slotId]; // 現在の武具（古い武具）
            if (removed === dataItem) {
                if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] すでに同じ武具が装備されている");
                scene.updateInventoryAndHotbar();
                return;
            }
            window.RSTH_IH.__Vanilla_GainItem(dataItem, 1, true);   //gamepartyに新しい武具を追加
            if (slot.count > 1) { slot.count--; } else { list[index] = null; }  // スロットから古い防具を消費
            actor.changeEquip(slotId, dataItem); //新しい武具を装備する→gamepartyに古い武具が追加→スロットに古い武具が入る
            window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, true);   //gamepartyから新しい武具を削除


            // 反映
            if (source === "inventory") {
                $gameSystem._customInventoryItems = list;
                SceneManager._scene._inventoryWindow?.setItems(list);
                SceneManager._scene._inventoryWindow?.refresh();
            } else {
                $gameSystem._customHotbarItems = list;
                SceneManager._scene._hotbarWindow?.setItems(list);
                SceneManager._scene._hotbarWindow?.refresh();
            }

            SceneManager._scene._equipmentWindow?.refresh();
            SoundManager.playEquip();
            return;
        }

        if (source === "hotbar") {
            const list = hotbar?.items;
            const index = slotIndex;
            if (index < 0) return;

            const slot = list[index];

            if (!slot) return; // ★ null 安全チェック
            window.RSTH_IH.__Vanilla_GainItem(dataItem, 1, false);

            if (actor.canUse(dataItem)) {
                const action = new Game_Action(actor);
                action.setItemObject(dataItem);
                const targets = action.makeTargets();
                for (const target of targets) action.apply(target);
                window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][hotbar]<<<<<<<<<hotbar slot.count>>>>>>>>${slot.count}`);
                if (slot.count > 1) {
                    slot.count--;
                } else {
                    list[index] = null;
                }

                hotbar?.refresh();
                inv?.refresh();
                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][hotbar]<<<<<<<<<hotbar slot.count??>>>>>>>>${slot.count}`);
            }

            return;
        }

        if (source === "inventory") {
            const list = inv?.items;
            const index = slotIndex ?? list?.findIndex(slot => slot && slot.id === item.id && slot.type === item.type);
            if (index < 0) return;

            const slot = list[index];
            if (!slot) return; // ★ null 安全チェック

            // 修正：gainItemせずに条件を手動チェック
            if ($gameParty.canInput() && actor.meetsUsableItemConditions(dataItem)) {
                const action = new Game_Action(actor);
                action.setItemObject(dataItem);
                const targets = action.makeTargets();
                for (const target of targets) action.apply(target);

                if (slot.count > 1) {
                    slot.count--;
                } else {
                    list[index] = null;
                }

                scene.updateInventoryAndHotbar();
            }

            return;
        }
    }

})();