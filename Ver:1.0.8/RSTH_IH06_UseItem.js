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
                //let [x, y] = window.RSTH_IH.getFrontTileXY(item.id);

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]item`, item);
                const gameItem = window.RSTH_IH.getGameItem(item);

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]gameItem`, gameItem);
                // tileOffsets1をJSONとしてパース
                let tileOffsets = [];
                try {
                    tileOffsets = JSON.parse(gameItem.meta.tileOffsets1 || "[]");
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]tileOffsets`, tileOffsets);
                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]tileOffsets1 parse error`, e);
                    return; // パースエラー時は設置しない
                }

                if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]tileOffsets`, tileOffsets);

                for (const offset of tileOffsets) {
                    const dx = Number(offset.dx || 0);
                    const dy = Number(offset.dy || 0);
                    //const px = x + dx;
                    //const py = y + dy;

                    const px = tileX + dx;
                    const py = tileY + dy;

                    if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]offset`, offset);
                    //if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place]評価位置 (${px}, ${py})`);
                    if (px < 0 || py < 0 || px >= $gameMap.width() || py >= $gameMap.height()) {
                        if (RSTH_DEBUG_LOG) console.warn(`[useInventoryItem][block]設置位置(${px},${py})がマップ外。設置キャンセル`);
                        return; // マップ外なら何もせず終了（アイテム消費なし）
                    }

                    // 通行不可タイルには設置できないようにするチェック
                    if (!$gameMap.checkPassage(px, py, 0x0f)) {
                        if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] (${px}, ${py})は通行不可タイルです。設置をスキップします。`);
                        return;
                    }

                    // 設置対象座標にイベントが存在するかチェック
                    if ($gameMap.eventsXy(px, py).length > 0) {
                        if (RSTH_DEBUG_LOG) console.warn(`[SurvivalBlockManager][place] (${px}, ${py}) にイベントが存在するため設置不可`);
                        return;
                    }

                    // プレイヤー自身がいる位置はNG
                    if ($gamePlayer.x === px && $gamePlayer.y === py) return;
                }



                // ブロックが未設置の場合のみ設置
                if (window.RSTH_IH.canPlaceBlockAt(tileX, tileY, gameItem)) {
                    const itemId = item.id;
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]ブロック設置: (${tileX}, ${tileY}) → tileId ${tileId}, itemId ${itemId}`);

                    // ブロック設置
                    window.RSTH_IH.SurvivalBlockManager.place(tileX, tileY, itemId);

                    // 追加されたブロック群から、中心ブロック（originX/Yと一致）を取得
                    const placedBlocks = window.RSTH_IH.SurvivalBlockManager._blocks;
                    const rootBlock = placedBlocks.find(b => b.originX === tileX && b.originY === tileY && b.growthStage === 0);

                    // growthTimeがあれば、そこに記録（必要ならブロック構造を拡張）
                    if (rootBlock && gameItem?.meta?.growthTime) {
                        const growthTime = Number(gameItem.meta.growthTime || 0);
                        rootBlock.growthTime = growthTime;
                        if (growthTime > 0) {
                            $gameSystem.rsthstartGrowthTimer(rootBlock.x, rootBlock.y, growthTime);
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
                if (!effective.includes(originBlock.tileId)) return;

                // 安全に origin から破壊
                window.RSTH_IH.SurvivalBlockManager.break(originX, originY);

                //SoundManager.playEnemyCollapse();
                return;
            }
        }

        // 防具なら装備処理（アイテム使用ではなく）
        if (DataManager.isArmor(dataItem)) {
            const list = (source === "inventory")
                ? $gameSystem._customInventoryItems
                : $gameSystem._customHotbarItems;

            const index = slotIndex ?? list?.findIndex(slot => slot && slot.id === item.id && slot.type === item.type);
            if (index < 0) return;




            const slot = list[index];
            if (!slot) return; // ★ null 安全チェック

            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 使用アイテム:", dataItem.name);
            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 使用元:", source, "index:", index);
            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 現在のslot.count:", slot.count);

            if (!actor.canEquip(dataItem)) {
                if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 装備不可");
                scene.updateInventoryAndHotbar();
                return;
            }

            const slotId = actor.equipSlots().findIndex(etypeId => etypeId === dataItem.etypeId);
            if (slotId === -1) {
                if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 該当スロットが存在しない");
                scene.updateInventoryAndHotbar();
                return;
            }

            const removed = actor.equips()[slotId]; // 現在の装備（古い装備）
            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 現在装備中:", removed?.name || "なし");

            if (removed === dataItem) {
                if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] すでに同じアイテムが装備されている");
                scene.updateInventoryAndHotbar();
                return;
            }

            if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][isArmor] 新装備(dataItem.name)${dataItem.name}を一時的に $gameParty に追加`);
            window.RSTH_IH.__Vanilla_GainItem(dataItem, 1, true);

            const invBefore = $gameSystem._customInventoryItems || [];
            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor][changeEquip前] 現在のインベントリ:", JSON.stringify(invBefore));

            actor.changeEquip(slotId, dataItem);

            const equipped = actor.equips()[slotId];
            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 装備後の状態:", equipped?.name || "装備失敗");

            let rollback = false;
            if (equipped === dataItem) {
                if (removed) {
                    if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 古い装備をRSTHに戻す:", removed.name);

                    window.RSTH_IH.removeItemFromInventoryOrHotbar(removed, 1);
                    $gameSystem._customHotbarItems = SceneManager._scene._hotbarWindow?.items;
                    SceneManager._scene._hotbarWindow.setItems($gameSystem._customHotbarItems);

                    let ok = true;

                    if (!window.RSTH_IH.insertOrStackToInventory(removed)) {
                        if (source === "hotbar") {
                            $gameSystem._customHotbarItems = SceneManager._scene._hotbarWindow?.items;
                        }
                        const remain = window.RSTH_IH.gainItemToHotbar(removed, 1);
                        const actuallyAdded = 1 - remain;
                        if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] gainItemToHotbar result (remain):", remain);
                        if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] actuallyAdded to hotbar:", actuallyAdded);
                        ok = (actuallyAdded > 0);


                        // ▼ スロットが1個の防具で、かつ交換条件を満たす場合
                        if (!ok && (source === "hotbar" || source === "inventory") && typeof slotIndex === "number") {
                            const isInventory = source === "inventory";
                            const list = isInventory ? $gameSystem._customInventoryItems : $gameSystem._customHotbarItems;
                            const slot = list?.[slotIndex];

                            if (slot && slot.id === dataItem.id && slot.type === "armor" && slot.count === 1) {
                                // スロットに removed（防具2）を戻す
                                list[slotIndex] = {
                                    id: removed.id,
                                    name: removed.name,
                                    iconIndex: removed.iconIndex,
                                    tileset: "IconSet",
                                    tileIndex: [removed.iconIndex],
                                    type: "armor",
                                    tileId: Number(removed.meta?.tileId || 0),
                                    blockName: String(removed.meta?.blockName || ""),
                                    count: 1
                                };

                                if (isInventory) {
                                    $gameSystem._customInventoryItems = list;
                                    if (SceneManager._scene._inventoryWindow) {
                                        SceneManager._scene._inventoryWindow.setItems(list);
                                        SceneManager._scene._inventoryWindow.refresh();
                                    }
                                } else {
                                    $gameSystem._customHotbarItems = list;
                                    if (SceneManager._scene._hotbarWindow) {
                                        SceneManager._scene._hotbarWindow.setItems(list);
                                        SceneManager._scene._hotbarWindow.refresh();
                                    }
                                }

                                if ($gameParty.leader().canEquip(dataItem)) {
                                    const equipTypeId = dataItem.etypeId;
                                    const slotId = $gameParty.leader().equipSlots().indexOf(equipTypeId);

                                    if (slotId >= 0) {
                                        $gameParty.leader().forceChangeEquip(slotId, dataItem);
                                        if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] forceChangeEquip により防具1を装備完了（装備可能）");
                                    }

                                    ok = true;
                                    if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] rollback抑止：装備交換成功（装備可能）");
                                } else {
                                    if (RSTH_DEBUG_LOG) console.warn("[useInventoryItem][isArmor] 入れ替え中止：キャラが防具1を装備できない");
                                }

                            }
                        }


                        if (!ok) {
                            if (RSTH_DEBUG_LOG) console.warn("[useInventoryItem][isArmor] rollback発動：古い装備を戻せない");
                            rollback = true;
                        }
                    }
                }

                if (rollback) {
                    if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor][rollback処理] 新装備を削除し、装備を戻す");
                    window.RSTH_IH.removeItemFromInventoryOrHotbar(dataItem, 1);
                    window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);
                    window.RSTH_IH.__Vanilla_GainItem(removed, 1, false);
                    actor.changeEquip(slotId, removed);
                    window.RSTH_IH.__Vanilla_GainItem(removed, -1, false);
                    scene.updateInventoryAndHotbar();
                    SceneManager._scene._inventoryWindow.refresh();
                    SceneManager._scene._hotbarWindow.refresh();
                    return;
                }

                if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 装備成功 → 新装備を $gameParty から削除");
                window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);
                SoundManager.playEquip();

                // ▼ ここで最新のlist再取得とindex再検索
                const updatedList = (source === "inventory") ? $gameSystem._customInventoryItems : $gameSystem._customHotbarItems;
                const updatedIndex = updatedList?.findIndex(slot => slot && slot.id === dataItem.id && slot.type === window.RSTH_IH.getItemType(dataItem));
                if (updatedIndex >= 0) {
                    const updatedSlot = updatedList[updatedIndex];
                    const total = updatedSlot.count || 1;

                    if (total > 1) {
                        updatedSlot.count--;
                        if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] RSTHスロットのcount減少:", updatedSlot.count);
                    } else {
                        updatedList[updatedIndex] = null;
                        if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] count==1のためnull化");
                    }
                } else {
                    if (RSTH_DEBUG_LOG) console.warn("[useInventoryItem][isArmor] 使用アイテムのスロットが見つからない");
                }

                if (source === "inventory") {
                    $gameSystem._customInventoryItems = updatedList;
                } else {
                    $gameSystem._customHotbarItems = updatedList;
                    SceneManager._scene._hotbarWindow?.setItems(updatedList);
                }

                scene.updateInventoryAndHotbar();
                scene._equipmentWindow?.refresh();
                return;
            }



            if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 装備失敗 → 新装備を削除");
            window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);
            scene.updateInventoryAndHotbar();
            return;
        }

        // 武器なら装備処理（アイテム使用ではなく）
        if (DataManager.isWeapon(dataItem)) {

            if (RSTH_DEBUG_LOG) console.log(`window.RSTH_IH.EnableWeaponEquip`, window.RSTH_IH.EnableWeaponEquip);
            if (!window.RSTH_IH.EnableWeaponEquip) return; // ← 武器装備をできなくした場合はreturnする
            const list = (source === "inventory")
                ? $gameSystem._customInventoryItems
                : $gameSystem._customHotbarItems;

            const index = slotIndex ?? list?.findIndex(slot => slot && slot.id === item.id && slot.type === item.type);
            if (index < 0) return;

            const slot = list[index];
            if (!slot) return;

            if (!actor.canEquip(dataItem)) {
                scene.updateInventoryAndHotbar();
                return;
            }

            const slotId = actor.equipSlots().findIndex(etypeId => etypeId === dataItem.etypeId);
            if (slotId === -1) {
                scene.updateInventoryAndHotbar();
                return;
            }

            const removed = actor.equips()[slotId];
            if (removed === dataItem) {
                scene.updateInventoryAndHotbar();
                return;
            }

            window.RSTH_IH.__Vanilla_GainItem(dataItem, 1, true);  // 一時追加
            actor.changeEquip(slotId, dataItem);
            const equipped = actor.equips()[slotId];

            if (equipped !== dataItem) {
                window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);  // ロールバック
                scene.updateInventoryAndHotbar();
                return;
            }

            let rollback = false;
            if (removed) {
                window.RSTH_IH.removeItemFromInventoryOrHotbar(removed, 1);
                $gameSystem._customHotbarItems = SceneManager._scene._hotbarWindow?.items;
                SceneManager._scene._hotbarWindow.setItems($gameSystem._customHotbarItems);
                let ok = true;

                if (!window.RSTH_IH.insertOrStackToInventory(removed)) {
                    const remain = window.RSTH_IH.gainItemToHotbar(removed, 1);
                    ok = (1 - remain) > 0;
                    if (!ok) rollback = true;
                }

                if (rollback) {
                    actor.changeEquip(slotId, removed);
                    window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);
                    window.RSTH_IH.__Vanilla_GainItem(removed, -1, false);
                    scene.updateInventoryAndHotbar();
                    return;
                }
            }

            window.RSTH_IH.__Vanilla_GainItem(dataItem, -1, false);
            SoundManager.playEquip();

            const updatedList = (source === "inventory") ? $gameSystem._customInventoryItems : $gameSystem._customHotbarItems;
            const updatedIndex = updatedList?.findIndex(slot => slot && slot.id === dataItem.id && slot.type === window.RSTH_IH.getItemType(dataItem));
            if (updatedIndex >= 0) {
                const updatedSlot = updatedList[updatedIndex];
                if (updatedSlot.count > 1) {
                    updatedSlot.count--;
                } else {
                    updatedList[updatedIndex] = null;
                }
            }

            if (source === "inventory") {
                $gameSystem._customInventoryItems = updatedList;
            } else {
                $gameSystem._customHotbarItems = updatedList;
                SceneManager._scene._hotbarWindow?.setItems(updatedList);
            }

            scene.updateInventoryAndHotbar();
            scene._equipmentWindow?.refresh();
            return;
        }

        if (source === "hotbar") {
            const list = hotbar?.items;
            const index = slotIndex ?? list?.findIndex(slot => slot && slot.id === item.id && slot.type === item.type);
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