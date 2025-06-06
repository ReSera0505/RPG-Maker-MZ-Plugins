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


    // インベントリに外部からアイテムを追加する場合
    window.RSTH_IH.gainItemToInventory = function (item, amount = 1) {
        if (!item || amount <= 0) return 0;

        if (RSTH_DEBUG_LOG) console.log(`[gainItemToInventory] item`, item);
        const inv = $gameSystem._customInventoryItems || [];
        const type = window.RSTH_IH.getItemType(item);
        if (RSTH_DEBUG_LOG) console.log(`[gainItemToInventory] type`, type);
        let remaining = amount;
        const maxStack = ["weapon", "armor", "tool"].includes(type) ? 1 : window.RSTH_IH.StackSize;

        // ① 既存スロットに加算できるかチェック
        for (let i = 0; i < inv.length; i++) {
            const slot = inv[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count < maxStack) {
                const space = window.RSTH_IH.StackSize - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) break;
            }
        }

        // ② 空きスロットに新規格納（ポーションなどが初めて追加されるとき）
        const maxSlots = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows;
        for (let i = 0; i < maxSlots && remaining > 0; i++) {
            if (!inv[i]) {
                const toAdd = Math.min(maxStack, remaining);
                if (!inv[i]) {
                    inv[i] = {
                        id: item.id,
                        type,
                        iconIndex: item.iconIndex,
                        name: item.name,
                        count: toAdd
                    };

                    // ブロックアイテムであれば、追加メタ情報を付加
                    if (inv[i].type === "block") {
                        const meta = $gameSystem.rsthgetBlockMetaByItemId(item.id);

                        if (RSTH_DEBUG_LOG) console.warn(`[gainItemToInventory] item.id`, item.id);
                        if (meta) {
                            inv[i].blockName = String(item.blockName || "");
                            inv[i].tileId = isNaN(Number(meta.tileId)) ? 0 : Number(meta.tileId);
                            inv[i].size = (meta.size && Array.isArray(meta.size)) ? meta.size : [1, 1];
                            inv[i].tileset = meta.tileset || "IconSet";

                            // tileOffsets1 の安全な代入
                            try {
                                inv[i].tileOffsets1 = Array.isArray(meta.tileOffsets1) ? meta.tileOffsets1 : item._tileOffsets1Parsed || [];
                            } catch (e) {
                                if (RSTH_DEBUG_LOG) console.error("[gainItemToInventory] tileOffsets1 parse error:", e, meta.tileOffsets1);
                                inv[i].tileOffsets1 = [];
                            }

                            // tileOffsets2 の安全な代入
                            try {
                                inv[i].tileOffsets2 = Array.isArray(meta.tileOffsets2) ? meta.tileOffsets2 : item._tileOffsets2Parsed || [];
                            } catch (e) {
                                if (RSTH_DEBUG_LOG) console.error("[gainItemToInventory] tileOffsets2 parse error:", e, meta.tileOffsets2);
                                inv[i].tileOffsets2 = [];
                            }

                            inv[i].growthTime = meta.growthTime;
                            inv[i].dropItems1 = meta.dropItems1;
                            inv[i].dropItems2 = meta.dropItems2;
                        }
                    }
                }

                if (RSTH_DEBUG_LOG) console.warn(`[gainItemToInventory] inv[${i}]`, inv[i]);

                remaining -= toAdd;
            }
        }

        // ③ システムに反映
        $gameSystem._customInventoryItems = inv;

        // ④ シーンに表示中なら再反映
        const win = SceneManager._scene?._inventoryWindow;
        if (win) {
            win.setItems(inv);
        }

        return remaining;
    }

    // ホットバーに外部からアイテムを追加する処理（RSTH仕様）
    window.RSTH_IH.gainItemToHotbar = function (item, amount = 1) {
        if (RSTH_DEBUG_LOG) console.log("[gainItemToHotbar]呼び出し");
        if (!item || amount <= 0) return 0;

        const hotbar = $gameSystem._customHotbarItems || [];
        const type = window.RSTH_IH.getItemType(item);
        let remaining = amount;
        const maxStack = ["weapon", "armor", "tool"].includes(type) ? 1 : window.RSTH_IH.StackSize;

        // ① 既存スロットに加算できるかチェック
        for (let i = 0; i < hotbar.length; i++) {
            const slot = hotbar[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count < maxStack) {
                const space = window.RSTH_IH.StackSize - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) break;
            }
        }

        // ② 空きスロットに新規格納（ポーションなどが初めて追加されるとき）
        for (let i = 0; i < window.RSTH_IH.HotbarSlotCount && remaining > 0; i++) {
            if (!hotbar[i]) {
                const toAdd = Math.min(maxStack, remaining);
                hotbar[i] = {
                    id: item.id,
                    type,
                    iconIndex: item.iconIndex,
                    name: item.name,
                    count: toAdd
                };

                // ブロックアイテムであれば、追加メタ情報を付加
                if (hotbar[i].type === "block") {
                    const meta = $gameSystem.rsthgetBlockMetaByItemId(item.id);

                    if (RSTH_DEBUG_LOG) console.warn(`[gainItemToHotbar] item.id`, item.id);
                    if (meta) {
                        hotbar[i].blockName = String(item.blockName || "");
                        hotbar[i].tileId = isNaN(Number(meta.tileId)) ? 0 : Number(meta.tileId);
                        hotbar[i].size = (meta.size && Array.isArray(meta.size)) ? meta.size : [1, 1];
                        hotbar[i].tileset = meta.tileset || "IconSet";

                        // tileOffsets1 の安全な代入
                        try {
                            hotbar[i].tileOffsets1 = Array.isArray(meta.tileOffsets1) ? meta.tileOffsets1 : item._tileOffsets1Parsed || [];
                        } catch (e) {
                            if (RSTH_DEBUG_LOG) console.error("[gainItemToHotbar] tileOffsets1 parse error:", e, meta.tileOffsets1);
                            hotbar[i].tileOffsets1 = [];
                        }

                        // tileOffsets2 の安全な代入
                        try {
                            hotbar[i].tileOffsets2 = Array.isArray(meta.tileOffsets2) ? meta.tileOffsets2 : item._tileOffsets2Parsed || [];
                        } catch (e) {
                            if (RSTH_DEBUG_LOG) console.error("[gainItemToHotbar] tileOffsets2 parse error:", e, meta.tileOffsets2);
                            hotbar[i].tileOffsets2 = [];
                        }

                        hotbar[i].growthTime = meta.growthTime;
                        hotbar[i].dropItems1 = meta.dropItems1;
                        hotbar[i].dropItems2 = meta.dropItems2;
                    }
                }


                if (RSTH_DEBUG_LOG) console.log(`[gainItemToHotbar] スロット${i}に新規追加: ${item.name} × ${toAdd}`);
                if (RSTH_DEBUG_LOG) console.log(`[gainItemToHotbar] item`, item);

                remaining -= toAdd;
            }
        }

        // ③ システムに反映
        $gameSystem._customHotbarItems = hotbar;

        // ④ シーンに表示中なら再反映
        const win = SceneManager._scene?._hotbarWindow;
        if (win) {
            win.setItems(hotbar);
            win.items = hotbar;
            win.refresh();
        }

        // アイテム追加後に再描画を強制
        if (SceneManager._scene && SceneManager._scene._hotbarWindow) {
            SceneManager._scene._hotbarWindow.refresh();
        }

        if (remaining > 0) {
            if (RSTH_DEBUG_LOG) console.warn("[gainItemToHotbar] ホットバーに追加できませんでした:", item.name);
            if (RSTH_DEBUG_LOG) console.warn("[gainItemToHotbar] 全スロット数:", window.RSTH_IH.HotbarSlotCount, "使用中:", hotbar.filter(e => e != null).length);
            if (RSTH_DEBUG_LOG) console.log(`[gainItemToHotbar] HotbarSlots=${window.RSTH_IH.HotbarSlotCount}, window.RSTH_IH.StackSize=${window.RSTH_IH.StackSize}`);
        }

        return remaining;
    };


    // 外部からアイテム入手時、インベントリ満杯の場合、ホットバーへ格納
    window.RSTH_IH.gainItemToInventoryThenHotbar = function (item, amount = 1) {
        const inv = $gameSystem._customInventoryItems ||= Array(window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows).fill(null);
        const hot = $gameSystem._customHotbarItems ||= Array(window.RSTH_IH.HotbarSlotCount).fill(null);
        let remaining = window.RSTH_IH.gainItemToInventory(item, amount);
        const addedToInventory = amount - remaining;

        remaining = window.RSTH_IH.gainItemToHotbar(item, remaining);

        const addedToHotbar = amount - addedToInventory - remaining;

        const addedTotal = addedToInventory + addedToHotbar;

        if (remaining > 0) {
            if (RSTH_DEBUG_LOG) console.warn("[gainItemToInventoryThenHotbar]あふれて破棄:", item.name, "x", remaining);

            const dropItem = Object.assign({}, item, { count: remaining });
            const playerX = $gamePlayer.x;
            const playerY = $gamePlayer.y;
            window.RSTH_IH.DropManager.dropItemSmart(playerX, playerY, dropItem);
        }


        if (SceneManager._scene?.updateInventoryAndHotbar) {
            SceneManager._scene.updateInventoryAndHotbar();
        }


        //if (RSTH_DEBUG_LOG) console.log("[gainItemToInventoryThenHotbar] ホットバーへの追加後:", JSON.stringify(hot));
        for (let i = 0; i < hot.length; i++) {
            const slot = hot[i];
            if (slot) {
                if (RSTH_DEBUG_LOG) console.log(`[gainItemToInventoryThenHotbar]→ スロット${i}: ${slot.name} × ${slot.count} itemId = ${slot.id}`);
            } else {
                if (RSTH_DEBUG_LOG) console.log(`[gainItemToInventoryThenHotbar]→ スロット${i}: 空`);
            }
        }

        if (SceneManager._scene?._hotbarWindow) {
            SceneManager._scene._hotbarWindow.setItems($gameSystem._customHotbarItems);
            SceneManager._scene._hotbarWindow.refresh();
        }

        // ← 実際に追加できた数を返すようにする
        return addedTotal;
    };

    // 装備解除で使う安全なインベントリ格納関数（インスタンスを追加せず count+1）
    window.RSTH_IH.insertOrStackToInventory = function (item) {
        if (!item) return false;

        const inv = $gameSystem._customInventoryItems || [];
        const type = window.RSTH_IH.getItemType(item);
        const maxSlots = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows;
        const maxStack = ["weapon", "armor", "tool"].includes(type) ? 1 : window.RSTH_IH.StackSize;


        if (RSTH_DEBUG_LOG) console.log("[insertOrStackToInventory] インベントリへの追加処理開始。", item.name);
        //if (RSTH_DEBUG_LOG) console.log("[insertOrStackToInventory] 現在のインベントリ:", JSON.stringify(inv));


        // ① スタック可能なスロットを探して加算（cloneして上書き）
        for (let i = 0; i < maxSlots; i++) {
            const slot = inv[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count < maxStack) {
                if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory][CHECK] slot.id=${slot.id}, item.id=${item.id}, slot.count=${slot.count}, window.RSTH_IH.StackSize=${maxStack}`);

                const newSlot = { ...slot, count: slot.count + 1 };
                inv[i] = newSlot;

                $gameSystem._customInventoryItems = inv;
                if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory] スロット${i}にスタック +1:`, newSlot);
                if (SceneManager._scene?._inventoryWindow) {
                    SceneManager._scene._inventoryWindow.setItems(inv);
                    SceneManager._scene._inventoryWindow.refresh();
                }
                return true;
            }
        }

        // ② 空きスロットに新規追加
        for (let i = 0; i < maxSlots; i++) {
            if (!inv[i]) {
                if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory][新規追加] スロット${i}が空いています`);
                inv[i] = {
                    id: item.id,
                    name: item.name,
                    iconIndex: item.iconIndex,
                    tileset: "IconSet",
                    tileIndex: [item.iconIndex],
                    type,
                    tileId: Number(item.meta?.tileId || 0),
                    blockName: String(item.meta?.blockName || ""),
                    count: 1
                };
                if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory] スロット${i}に新規追加:`, inv[i]);

                $gameSystem._customInventoryItems = inv;

                if (SceneManager._scene?._inventoryWindow) {
                    SceneManager._scene._inventoryWindow.setItems(inv);
                    SceneManager._scene._inventoryWindow.refresh();
                }
                return true;
            } else {
                //if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory][使用不可] スロット${i} → id=${inv[i].id}, name=${inv[i].name}, count=${inv[i].count}`);
            }
        }
        // ③ どこにも格納できなかった
        if (RSTH_DEBUG_LOG) console.warn("[insertOrStackToInventory] インベントリに追加できませんでした:", item.name);
        if (RSTH_DEBUG_LOG) console.warn("[insertOrStackToInventory] 全スロット数:", maxSlots, "使用中:", inv.filter(e => e != null).length);
        if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory] InventorySlots=${window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows}, window.RSTH_IH.StackSize=${window.RSTH_IH.StackSize}`);

        return false;
    };

    // 指定したアイテムをインベントリまたはホットバーから1個削除
    window.RSTH_IH.removeItemFromInventoryOrHotbar = function (item, amount = 1) {
        if (!item || amount <= 0) return;

        const type = window.RSTH_IH.getItemType(item);
        const inv = $gameSystem._customInventoryItems || [];
        const hot = $gameSystem._customHotbarItems || [];

        let remaining = amount;

        // インベントリから削除
        for (let i = 0; i < inv.length && remaining > 0; i++) {
            const slot = inv[i];
            if (slot && slot.id === item.id && slot.type === type) {
                const toRemove = Math.min(slot.count, remaining);
                slot.count -= toRemove;
                remaining -= toRemove;
                if (slot.count <= 0) inv[i] = null;
            }
        }

        // ホットバーから削除
        for (let i = 0; i < hot.length && remaining > 0; i++) {
            const slot = hot[i];
            if (slot && slot.id === item.id && slot.type === type) {
                const toRemove = Math.min(slot.count, remaining);
                slot.count -= toRemove;
                remaining -= toRemove;
                if (slot.count <= 0) hot[i] = null;
            }
        }

        $gameSystem._customInventoryItems = inv;
        $gameSystem._customHotbarItems = hot;

        if (SceneManager._scene?.updateInventoryAndHotbar) {
            SceneManager._scene.updateInventoryAndHotbar();
        }

        return amount - remaining; // 実際に削除できた数
    };

    // インベントリのアイテムを外部から削除する場合
    window.RSTH_IH.loseItemFromInventory = function (item, amount = 1) {
        if (!item || amount <= 0) return false;

        const inv = $gameSystem._customInventoryItems || [];
        const type = (() => {
            if (DataManager.isItem(item)) return "item";
            if (DataManager.isWeapon(item)) return "weapon";
            if (DataManager.isArmor(item)) return "armor";
            return "unknown";
        })();

        let remaining = amount;

        for (let i = 0; i < inv.length; i++) {
            const slot = inv[i];
            if (slot && slot.id === item.id && slot.type === type) {
                const toRemove = Math.min(slot.count, remaining);
                slot.count -= toRemove;
                remaining -= toRemove;

                if (slot.count <= 0) {
                    inv.splice(i, 1);
                    i--; // 削除したので index 調整
                    inv[i] = null;
                }

                if (remaining <= 0) break;
            }
        }

        // 書き戻し
        $gameSystem._customInventoryItems = inv;

        if (SceneManager._scene?.updateInventoryAndHotbar) {
            SceneManager._scene.updateInventoryAndHotbar();
        }

        if (remaining > 0) {
            if (RSTH_DEBUG_LOG) console.warn("[loseItemFromInventory]インベントリに十分な個数がないため一部しか消費できなかった:", item.name, "x", amount - remaining);
        }

        return true;
    }

    // 一度だけ元の gainItem を保存する
    if (!Game_Party.prototype.gainItem.__RSTH_Original) {
        Game_Party.prototype.gainItem.__RSTH_Original = Game_Party.prototype.gainItem;
    }
    const _Game_Party_gainItem = Game_Party.prototype.gainItem.__RSTH_Original;
    // 通常のgainitemの処理を呼ばれた場合はまずこの処理をする
    Game_Party.prototype.gainItem = function (item, amount, includeEquip = false) {
        if (!item || amount <= 0) return;

        // オーバーライドする前のgainitem処理を呼び出す
        if (this._suppressRSTH) {
            return _Game_Party_gainItem.call(this, item, amount, includeEquip);
        }

        if (RSTH_DEBUG_LOG) console.log(`[gainItem] item.name ${item.name}`);
        const gameItem = (() => {
            if (DataManager.isItem(item)) return $dataItems[item.id];
            if (DataManager.isWeapon(item)) return $dataWeapons[item.id];
            if (DataManager.isArmor(item)) return $dataArmors[item.id];
            return null;
        })();

        if (!gameItem) return;

        //ここからの処理で通常のインベントリ、ホットバーにアイテム追加と$gamepartyのアイテム削除処理が完結
        //この処理でインベントリかホットバーにアイテムが追加される
        if (RSTH_DEBUG_LOG) console.log(`[gainItem] ${gameItem.name} を インベントリに ${amount}個追加`);
        window.RSTH_IH.gainItemToInventoryThenHotbar(gameItem, amount);


        // 必ず vanilla 側の gainItem によって追加されているので、強制削除する
        this._suppressRSTH = true;
        _Game_Party_gainItem.call(this, gameItem, -amount, includeEquip);
        this._suppressRSTH = false;

        if (RSTH_DEBUG_LOG) console.warn(`[gainItem] ${gameItem.name} を $gameParty から ${amount}個強制削除`);
        //ここまで
    };







})();