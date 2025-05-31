/*:
 * @target MZ
 * @plugindesc RSTH_IH: インベントリ＋ホットバー UI プラグイン ver1.0.7
 * @author ReSera_りせら
 *
 * @help
 * このプラグインはマップ画面にインベントリとホットバーUIを追加します。
 * プレイヤーの持ち物やショートカットバー（ホットバー）を視覚的に管理できます。
 *
 * ▼ 主な機能
 * - マウスによるドラッグ＆ドロップでインベントリやホットバー間のアイテム移動が可能
 * - Shiftキー押下によるアイテムの一括移動
 * - ダブルクリックでアイテムを使用（道具、武器、ブロック、装備に対応）
 * - スタック（所持数の管理）対応
 * - ホットバーは数字キー（1～0）で選択・使用可能
 * - ブロックの設置やツールによる破壊にも対応
 * - "RSTH_Survival.js", "RSTH_EquipmentUI.js" との連携必須
 *
 * ▼ 注意事項
 * - 通常の "gainItem" でインベントリ、ホットバーに追加されるようになりました。
 * 
 * - 入手したアイテムはインベントリが満杯になるとホットバーへ格納されます。
 *   ホットバーも満杯の場合にアイテムを入手するとあふれたものは削除されます。
 *   （今後マップにドロップするように改善する予定）
 * 
 * - 使用後のアイテムは自動的に1個減少し、0になればスロットが空になります。
 * - 通常のアイテム所持数と連動せず、内部的に "_customInventoryItems", "_customHotbarItems" に保持されます。
 * 
 * - RSTH_EquipmentUI.jsとRSTH_Survival.jsよりも**上に**配置してください。
 * 
 * ▼ 使用方法
 * プロジェクトの「js/plugins」フォルダにこのファイルを追加し、
 * プラグインマネージャーから有効にしてください。
 * マップ画面で "E" キーを押すとインベントリが開閉します。
 *
 * ▼ 注意事項
 * - RSTH_EquipmentUI.jsとRSTH_Survival.jsの前に配置してください。
 * - グローバル汚染を避けるため、window.RSTH_IH 名前空間を使用しています。
 *
 * ▼ ライセンス
 * このプラグインは MITライセンス の下で公開されています。
 * 
 * ----------------------------
 * 変更履歴:
 * ----------------------------
 * 
 * Ver.1.0.7 - 2025/05/31
 *     RSTH_Survival.jsに合わせて内容を修正。
 * 
 * Ver.1.0.6 - 2025/05/29
 *     インベントリ、ホットバーのprocessTouch()関連の処理を修正。
 *     ブロック設置前の判定を強化。
 * 
 * Ver.1.0.5 - 2025/05/27
 *     インベントリ、ホットバーがメッセージウィンドウより下に表示されるように修正。
 * 
 * Ver.1.0.4 - 2025/05/27
 *   - アイテムを二重に使用するバグを修正。
 *     武器をダブルクリック、数字キー押下で装備できるように修正
 *     武器を装備するシステム自体をありにするか、なしにするかを
 *     プラグインパラメータで設定できるように修正
 * 
 * Ver.1.0.3 - 2025/05/27
 *   - インベントリ満杯、ホットバーに空きスロットが1つ、 他スロットに防具2が存在し、
 *     防具1を装備している状態で、防具2があるスロットに対応する数字キーを押下後、
 *     防具2が装備されるが、外された防具1がホットバーに格納されないバグを修正。
 *     RSTH_DEBUG_LOG がtrueの場合のみこのファイルのコンソールログを出力するように修正
 * 
 * Ver.1.0.2 - 2025/05/26
 *   - インベントリとホットバーが満杯の時、メニューの装備から装備を外せないように修正
 * 
 * Ver.1.0.1 - 2025/05/26
 *   - 通常イベントのアイテム入手処理からインベントリ、ホットバーに格納できるように修正
 * 
 * Ver.1.0.0 - 2025/05/25
 *   - 初版公開
 * 
 * @param HotbarPosition
 * @text ホットバーの画面配置
 * @type select
 * @option topleft
 * @option top
 * @option topright
 * @option bottomleft
 * @option bottom
 * @option bottomright
 * @default bottomright
 * @desc ホットバーの画面上の位置を指定します。
 * 
 * @param HotbarSlotSize
 * @type number
 * @default 32
 *
 * @param HotbarPrevKey
 * @type string
 * @default [
 *
 * @param HotbarNextKey
 * @type string
 * @default ]
 *
 * @param InventoryCols
 * @type number
 * @default 10
 *
 * @param InventoryRows
 * @type number
 * @default 6
 *
 * @param InventorySlotSize
 * @type number
 * @default 32
 *
 * @param StackSize
 * @type number
 * @default 99
 *  
 * @param EnableWeaponEquip
 * @text 武器を装備可能にする
 * @type boolean
 * @default true
 * @desc ダブルクリックまたは数字キーで武器を装備する機能をON/OFFできます。
 */

(() => {
    "use strict";

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    const RSTH_DEBUG_LOG = false;

    const p = PluginManager.parameters("RSTH_IH");

    const StackSize = Number(p["StackSize"] || 99);

    //ホットバー関連の宣言
    const HotbarSlotSize = Number(p["HotbarSlotSize"] || 32);
    const HotbarPrevKey = p["HotbarPrevKey"] || "[";
    const HotbarNextKey = p["HotbarNextKey"] || "]";
    const HotbarSlotCount = 10;//10固定。変更しないこと
    const Hotbarmargin = 8;
    const Hotbarpadding = 12;
    const HotbarcontentWidth = HotbarSlotCount * HotbarSlotSize + (HotbarSlotCount - 1) * Hotbarmargin;
    const Hotbarwidth = HotbarcontentWidth + Hotbarpadding * 2;
    const Hotbarheight = HotbarSlotSize + Hotbarpadding * 2;
    const HotbarPosition = p["HotbarPosition"] || "bottomright";

    //インベントリ関連の宣言
    const InventorySlotSize = Number(p["InventorySlotSize"] || 32);
    const InventoryCols = Number(p["InventoryCols"] || 10);
    const InventoryRows = Number(p["InventoryRows"] || 6);
    const Inventorymargin = 8;
    const Inventorypadding = 12;
    const InventorycontentWidth = InventoryCols * InventorySlotSize + (InventoryCols - 1) * Inventorymargin;
    const InventorycontentHeight = InventoryRows * InventorySlotSize + (InventoryRows - 1) * Inventorymargin;
    const Inventorywidth = InventorycontentWidth + Inventorypadding * 2;
    const Inventoryheight = InventorycontentHeight + Inventorypadding * 2;

    const EnableWeaponEquip = p["EnableWeaponEquip"] === "true";


    window.RSTH_IH = window.RSTH_IH || {};
    window.RSTH_IH.__draggingItem = null;
    window.RSTH_IH.__draggingFrom = null;
    window.RSTH_IH.__draggingIndex = null;

    let __hotbarKeyListenerAdded = false;




    const __Vanilla_GainItem = function (item, amount, includeEquip) {
        if (item) {
            const container = $gameParty.itemContainer(item);
            if (container) {
                const lastNumber = $gameParty.numItems(item);
                const newNumber = lastNumber + amount;
                container[item.id] = Math.max(newNumber, 0);
                if (container[item.id] === 0) {
                    delete container[item.id];
                }
            }
        }
    };

    // ▼ 共通関数：スロット情報 → 実データ
    function getGameItem(item) {
        if (item.type === "item") return $dataItems[item.id];
        if (item.type === "weapon") return $dataWeapons[item.id];
        if (item.type === "armor") return $dataArmors[item.id];
        if (item.type === "block") return $dataItems[item.id];
        if (item.type === "tool") return $dataWeapons[item.id];
        return null;
    }

    // ホットバーの位置の設定
    function calculateHotbarPosition() {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        let x = 0;
        let y = 0;

        switch (HotbarPosition) {
            case "topleft":
                x = 20;
                y = 20;
                break;
            case "top":
                x = (gw - Hotbarwidth) / 2;
                y = 20;
                break;
            case "topright":
                x = gw - Hotbarwidth - 20;
                y = 20;
                break;
            case "bottomleft":
                x = 20;
                y = gh - Hotbarheight - 20;
                break;
            case "bottom":
                x = (gw - Hotbarwidth) / 2;
                y = gh - Hotbarheight - 20;
                break;
            case "bottomright":
                x = gw - Hotbarwidth - 20;
                y = gh - Hotbarheight - 20;
                break;
        }

        return { x, y };
    }

    // インベントリの位置を設定
    function calculateInventoryPosition(hotbarX, hotbarY) {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        const below = HotbarPosition.startsWith("top"); // 上にあるホットバーなら下に表示
        const invX = hotbarX + (Hotbarwidth - Inventorywidth) / 2;
        const invY = below
            ? hotbarY + Hotbarheight + 10
            : hotbarY - Inventoryheight - 10;

        return {
            x: Math.max(0, Math.min(invX, gw - Inventorywidth)),
            y: Math.max(0, Math.min(invY, gh - Inventoryheight))
        };
    }

    // ポップアップテキスト表示
    function updateHoverTextShared(self, items) {
        if (!self.isOpen?.() || !self.visible) return;

        const popup = SceneManager._scene._hoverTextSprite;
        if (!popup) return;

        const x = self.canvasToLocalX(TouchInput.x);
        const y = self.canvasToLocalY(TouchInput.y);
        const index = self.hitTest(x, y);

        if (index >= 0 && items[index]) {
            const name = String(items[index].name || "");
            if (popup._text !== name) {
                popup.setText(name);
            }
            window.RSTH_IH.__popupOwner = self;
        } else if (window.RSTH_IH.__popupOwner === self) {
            popup.setText("");
            window.RSTH_IH.__popupOwner = null;
        }
    }

    class Sprite_PopupText extends Sprite {
        constructor() {
            super(new Bitmap(256, 40));
            this._text = "";
            this.visible = false;
            this.anchor.x = 0;
            this.anchor.y = 1;
            this.padding = 6;
        }

        setText(text) {
            this._text = typeof text === "string" ? text : String(text || "");
            this.visible = !!this._text;

            this.bitmap.clear();

            if (this.visible) {
                this.bitmap.fontSize = 20;
                this.bitmap.textColor = "#ffffff";
                this.bitmap.outlineColor = "#000000";
                this.bitmap.outlineWidth = 3;

                const w = this.bitmap.width - this.padding * 2;
                const h = this.bitmap.height;
                this.bitmap.drawText(this._text, this.padding, 0, w, h, "left");
            }
        }

        update() {
            super.update();
            if (this.visible) {
                this.x = TouchInput.x + 16;
                this.y = TouchInput.y;
            }
        }
    }

    // プレイヤーの正面タイルの座標を取得する関数
    function getFrontTileXY(itemId) {
        const dir = $gamePlayer.direction();
        const baseX = $gamePlayer.x + (dir === 6 ? 1 : dir === 4 ? -1 : 0);
        const baseY = $gamePlayer.y + (dir === 2 ? 1 : dir === 8 ? -1 : 0);

        const item = $dataItems[itemId];
        let sizeX = 1, sizeY = 1;
        if (item?.meta?.size) {
            try {
                const size = JSON.parse(item.meta.size);
                sizeX = Number(size[0]) || 1;
                sizeY = Number(size[1]) || 1;
            } catch (e) { }
        }

        // 方向によって原点補正
        let offsetX = 0;
        let offsetY = 0;
        if (dir === 4) { // 左向き
            offsetX = -(sizeX - 1);
        } else if (dir === 8) { // 上向き
            offsetY = -(sizeY - 1);
        }

        return [baseX + offsetX, baseY + offsetY];
    }


    // アイテム種別判定
    function getItemType(item) {
        if (DataManager.isItem(item)) {
            const tileId = Number(item.meta?.tileId);
            if (!isNaN(tileId)) {
                if (RSTH_DEBUG_LOG) console.log("[getItemType(item)]種別: block と判定されました", item.name, "tileId:", tileId);
                return "block";
            }
            return "item";
        }
        if (DataManager.isWeapon(item)) {
            if (item.meta?.tool !== undefined) {
                if (RSTH_DEBUG_LOG) console.log("[getItemType(item)]種別: tool と判定されました", item.name);
                return "tool"; // toolタグがあればツールとして扱う
            }
            return "weapon";
        }
        if (DataManager.isArmor(item)) return "armor";
        return "unknown";
    }

    // 武器がツールか否か
    function isToolWeapon(item) {
        return DataManager.isWeapon(item) && item.meta.tool !== undefined;
    }

    // ツールがブロックに対して有効であるか否か
    function getEffectiveBlocks(item) {
        try {
            return JSON.parse(item.meta.blockEffective || "[]");
        } catch (e) {
            return [];
        }
    }


    const _Game_Player_moveByInput = Game_Player.prototype.moveByInput;
    Game_Player.prototype.moveByInput = function () {
        const scene = SceneManager._scene;

        if (window.RSTH_IH.__draggingItem) {

            if (RSTH_DEBUG_LOG) console.warn(`[moveByInput] window.RSTH_IH.__draggingItem`, window.RSTH_IH.__draggingItem);
            return;
        }

        const mouseX = TouchInput.x;
        const mouseY = TouchInput.y;

        const windows = [
            scene?._inventoryWindow,
            scene?._hotbarWindow,
            scene?._equipmentWindow,
        ];

        for (const win of windows) {
            if (!win) continue;

            // ウィンドウが開いていてクリック位置がウィンドウ内にある場合は移動禁止
            const isOpen = win.visible && win.openness > 0;
            if (!isOpen) continue;

            const wx = win.x;
            const wy = win.y;
            const ww = win.width;
            const wh = win.height;

            if (mouseX >= wx && mouseX < wx + ww && mouseY >= wy && mouseY < wy + wh) {
                return; // マウスがウィンドウ上にある → 移動キャンセル
            }
        }

        _Game_Player_moveByInput.call(this);
    };



    Window.prototype.isTouchedInsideFrame = function () {
        // 非表示や閉じているウィンドウは当たり判定対象外
        if (!this.visible || this.openness < 255) return false;

        const x = TouchInput.x - this.x;
        const y = TouchInput.y - this.y;
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    };


    window.RSTH_IH.hasFreeSpaceForItem = function (item) {
        const inv = $gameSystem._customInventoryItems || [];
        const hot = $gameSystem._customHotbarItems || [];
        const type = getItemType(item);

        // 既存スロットでスタックできるか？
        for (const slot of inv) {
            if (slot && slot.id === item.id && slot.type === type && slot.count < StackSize) {
                return true;
            }
        }
        for (const slot of hot) {
            if (slot && slot.id === item.id && slot.type === type && slot.count < StackSize) {
                return true;
            }
        }

        // 空きスロット確認（明示的に最大数までチェック）
        const maxInv = InventoryCols * InventoryRows;
        const maxHot = 10;

        let invSlots = 0;
        for (let i = 0; i < maxInv; i++) {
            if (!inv[i]) {
                return true;
            }
            invSlots++;
        }

        for (let i = 0; i < maxHot; i++) {
            if (!hot[i]) {
                return true;
            }
        }

        return false; // スタックも空きスロットもなし
    };


    // インベントリに外部からアイテムを追加する場合
    window.RSTH_IH.gainItemToInventory = function (item, amount = 1) {
        if (!item || amount <= 0) return 0;

        const inv = $gameSystem._customInventoryItems || [];
        const type = getItemType(item);
        let remaining = amount;

        // ① 既存スロットに加算できるかチェック
        for (let i = 0; i < inv.length; i++) {
            const slot = inv[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count < StackSize) {
                const space = StackSize - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) break;
            }
        }

        // ② 空きスロットに新規格納（ポーションなどが初めて追加されるとき）
        const maxSlots = InventoryCols * InventoryRows;
        for (let i = 0; i < maxSlots && remaining > 0; i++) {
            if (!inv[i]) {
                const toAdd = Math.min(StackSize, remaining);

                const tileId = Number(item.meta.tileId || 0);
                const blockName = String(item.meta.blockName || "");
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
                            inv[i].blockName = String(item.meta.blockName || "");
                            inv[i].tileId = isNaN(Number(meta.tileId)) ? 0 : Number(meta.tileId);
                            inv[i].size = (meta.size && Array.isArray(meta.size)) ? meta.size : [1, 1];
                            inv[i].tileset = meta.tileset || "IconSet";

                            // tileOffsets1 の安全な代入
                            try {
                                inv[i].tileOffsets1 = Array.isArray(meta.tileOffsets1) ? meta.tileOffsets1 : JSON.parse(meta.tileOffsets1 || "[]");
                            } catch (e) {
                                if (RSTH_DEBUG_LOG) console.error("[gainItemToInventory] tileOffsets1 parse error:", e, meta.tileOffsets1);
                                inv[i].tileOffsets1 = [];
                            }

                            // tileOffsets2 の安全な代入
                            try {
                                inv[i].tileOffsets2 = Array.isArray(meta.tileOffsets2) ? meta.tileOffsets2 : JSON.parse(meta.tileOffsets2 || "[]");
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
        const type = getItemType(item);
        let remaining = amount;

        // ① 既存スロットに加算できるかチェック
        for (let i = 0; i < hotbar.length; i++) {
            const slot = hotbar[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count < StackSize) {
                const space = StackSize - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) break;
            }
        }

        // ② 空きスロットに新規格納（ポーションなどが初めて追加されるとき）
        for (let i = 0; i < 10 && remaining > 0; i++) {
            if (!hotbar[i]) {
                const toAdd = Math.min(StackSize, remaining);
                const tileId = Number(item.meta?.tileId || 0);
                const blockName = String(item.meta?.blockName || "");

                hotbar[i] = {
                    id: item.id,
                    name: item.name,
                    iconIndex: item.iconIndex,
                    tileset: "IconSet",
                    tileIndex: [item.iconIndex],
                    type,
                    tileId,
                    blockName,
                    count: toAdd
                };
                if (RSTH_DEBUG_LOG) console.log(`[gainItemToHotbar] スロット${i}に新規追加: ${item.name} × ${toAdd}`);

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
            if (RSTH_DEBUG_LOG) console.warn("[gainItemToHotbar] 全スロット数:", 10, "使用中:", hotbar.filter(e => e != null).length);
            if (RSTH_DEBUG_LOG) console.log(`[gainItemToHotbar] HotbarSlots=10, StackSize=${StackSize}`);
        }

        return remaining;
    };


    // 外部からアイテム入手時、インベントリ満杯の場合、ホットバーへ格納
    window.RSTH_IH.gainItemToInventoryThenHotbar = function (item, amount = 1) {
        const inv = $gameSystem._customInventoryItems ||= Array(InventoryCols * InventoryRows).fill(null);
        const hot = $gameSystem._customHotbarItems ||= Array(10).fill(null);
        let remaining = window.RSTH_IH.gainItemToInventory(item, amount);
        const addedToInventory = amount - remaining;

        remaining = window.RSTH_IH.gainItemToHotbar(item, remaining);

        const addedToHotbar = amount - addedToInventory - remaining;

        const addedTotal = addedToInventory + addedToHotbar;

        if (remaining > 0) {
            if (RSTH_DEBUG_LOG) console.warn("[gainItemToInventoryThenHotbar]あふれて破棄:", item.name, "x", remaining);
        }

        if (SceneManager._scene?.updateInventoryAndHotbar) {
            SceneManager._scene.updateInventoryAndHotbar();
        }


        if (RSTH_DEBUG_LOG) console.log("[gainItemToInventoryThenHotbar] ホットバーへの追加後:", JSON.stringify(hot));
        for (let i = 0; i < hot.length; i++) {
            const slot = hot[i];
            if (slot) {
                if (RSTH_DEBUG_LOG) console.log(`[gainItemToInventoryThenHotbar]→ スロット${i}: ${slot.name} × ${slot.count}`);
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
        const type = getItemType(item);
        const maxSlots = InventoryCols * InventoryRows;
        const maxStack = StackSize;

        if (RSTH_DEBUG_LOG) console.log("[insertOrStackToInventory] インベントリへの追加処理開始。", item.name);
        //if (RSTH_DEBUG_LOG) console.log("[insertOrStackToInventory] 現在のインベントリ:", JSON.stringify(inv));


        // ① スタック可能なスロットを探して加算（cloneして上書き）
        for (let i = 0; i < maxSlots; i++) {
            const slot = inv[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count < maxStack) {
                if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory][CHECK] slot.id=${slot.id}, item.id=${item.id}, slot.count=${slot.count}, StackSize=${maxStack}`);

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
        if (RSTH_DEBUG_LOG) console.log(`[insertOrStackToInventory] InventorySlots=${InventoryCols * InventoryRows}, StackSize=${StackSize}`);

        return false;
    };



    // 指定したアイテムをインベントリまたはホットバーから1個削除
    window.RSTH_IH.removeItemFromInventoryOrHotbar = function (item, amount = 1) {
        if (!item || amount <= 0) return;

        const type = getItemType(item);
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

    // ウィンドウの共通リフレッシュ処理
    function drawItemSlotGrid(self, items, cols, rows, tileSize, margin, selectedIndex = -1) {
        self.contents.clearRect(0, 0, self.contents.width, self.contents.height);

        const max = cols * rows;
        if (!Array.isArray(items)) return;

        for (let i = 0; i < max; i++) {
            const item = items[i];
            const snapshot = item ? JSON.parse(JSON.stringify(item)) : null;
            if (RSTH_DEBUG_LOG) console.log(`[drawItemSlotGrid] index=${i}, item=`, snapshot);

            const rect = self.itemRect(i);

            self.contents.paintOpacity = 128;
            self.contents.fillRect(rect.x, rect.y, rect.width, rect.height, "#222");
            self.contents.paintOpacity = 255;

            if (item) {
                const bitmap = ImageManager.loadSystem("IconSet");
                const pw = 32, ph = 32;
                const sx = (item.iconIndex % 16) * pw;
                const sy = Math.floor(item.iconIndex / 16) * ph;
                self.contents.blt(bitmap, sx, sy, pw, ph, rect.x, rect.y, rect.width, rect.height);

                const count = item.count || 1;
                if (count > 1) {
                    self.contents.fontSize = 18;
                    self.contents.textColor = "#ffffff";
                    self.contents.outlineColor = "#000000";
                    self.contents.outlineWidth = 3;
                    self.contents.drawText(
                        count,
                        rect.x,
                        rect.y + rect.height - 20,
                        rect.width - 4,
                        20,
                        "right"
                    );
                }
            }

            if (i === selectedIndex) {
                self.contents.strokeRect(rect.x, rect.y, rect.width, rect.height, "#ffffff", 3);
            }
        }
    }

    // ウィンドウのsetitems共通処理
    function setItemsSafe(self, items, storageKey = null) {
        if (!self.items) self.items = [];

        const changed =
            self.items.length !== items.length ||
            items.some((item, i) => {
                const current = self.items[i];
                return !current || !item || current.id !== item.id || current.count !== item.count;
            });

        if (!changed) return;

        self.items = items.map(item => item ? JSON.parse(JSON.stringify(item)) : null);


        if (storageKey) {
            $gameSystem[storageKey] = self.items;
        }

    }

    // ウィンドウのprocessTouch()共通処理
    function handleSlotTouchShared(self, contextType, itemList, onUseItem) {
        if (!self.visible || self.openness <= 0) return;

        const x = self.canvasToLocalX(TouchInput.x);
        const y = self.canvasToLocalY(TouchInput.y);
        const index = self.hitTest(x, y);

        // スロット選択
        if (index >= 0 && index !== self.selectedIndex && typeof self.selectSlotByIndex === "function") {
            self.selectSlotByIndex(index);
        }


        // ドラッグ開始
        if (TouchInput.isTriggered() && index >= 0 && itemList[index]) {
            window.RSTH_IH.__draggingItem = itemList[index];
            window.RSTH_IH.__draggingFrom = contextType;
            window.RSTH_IH.__draggingIndex = index;
        }


        // ダブルクリックで使用
        if (TouchInput.isReleased() && self.active && self.visible && self.isTouchedInsideFrame()) {
            const releasedIndex = self.hitTest(x, y);
            if (releasedIndex >= 0 && itemList[releasedIndex]) {
                const now = performance.now();
                const doubleClicked =
                    self._lastClickIndex === releasedIndex &&
                    now - (self._lastClickTime || 0) < 300;

                self._lastClickTime = now;
                self._lastClickIndex = releasedIndex;

                if (doubleClicked) {
                    if (RSTH_DEBUG_LOG) console.log(`[handleSlotTouchShared]${contextType}：ダブルクリックで使用:`, itemList[releasedIndex]);
                    onUseItem(itemList[releasedIndex], releasedIndex);
                    self.refresh();
                }
            }
        }


    }

    function handleInventoryDragDrop(self) {
        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]0`);
        if (!TouchInput.isReleased() || !window.RSTH_IH.__draggingItem) return;

        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]1`);

        const draggingFrom = window.RSTH_IH.__draggingFrom;
        const draggingIndex = window.RSTH_IH.__draggingIndex;
        const draggingItem = window.RSTH_IH.__draggingItem;

        const from = draggingFrom;
        const fromIndex = draggingIndex;
        const item = draggingItem;

        const hotbar = SceneManager._scene._hotbarWindow;
        const inv = SceneManager._scene._inventoryWindow;

        const invX = inv.canvasToLocalX(TouchInput.x);
        const invY = inv.canvasToLocalY(TouchInput.y);
        const index = inv.hitTest(invX, invY);

        const isSameWindow = (from === "hotbar" && self instanceof Window_Hotbar) ||
            (from === "inventory" && self instanceof Window_Inventory);
        const isInventoryOpen = SceneManager._scene?._inventoryWindow?.visible;
        if (!isInventoryOpen && !isSameWindow) {
            resetDragging();
            return;
        }

        // ▼ インベントリ → ホットバー
        if (from === "inventory" && isInventoryOpen) {
            const hx = TouchInput.x - hotbar.x - hotbar.padding;
            const hy = TouchInput.y - hotbar.y - hotbar.padding;
            const hotbarIndex = hotbar.hitTest(hx, hy);
            if (hotbarIndex >= 0) {
                const shift = Input.isPressed("shift");
                const amount = shift ? (item.count || 1) : 1;
                const fromSlot = inv.items[fromIndex];
                const targetSlot = hotbar.items[hotbarIndex];

                let moved = 0;

                if (targetSlot &&
                    targetSlot.id === item.id &&
                    targetSlot.type === item.type &&
                    targetSlot.count < StackSize
                ) {
                    const space = StackSize - targetSlot.count;
                    const toAdd = Math.min(space, amount);
                    targetSlot.count += toAdd;
                    moved = toAdd;

                    if (fromSlot.count > moved) {
                        fromSlot.count -= moved;
                    } else {
                        inv.items[fromIndex] = null;
                    }

                } else if (!targetSlot) {
                    const toAdd = Math.min(StackSize, amount);
                    const newItem = Object.assign({}, item);
                    newItem.count = toAdd;
                    hotbar.items[hotbarIndex] = newItem;
                    moved = toAdd;

                    if (fromSlot.count > moved) {
                        fromSlot.count -= moved;
                    } else {
                        inv.items[fromIndex] = null;
                    }

                } else {
                    const tmp = hotbar.items[hotbarIndex];
                    hotbar.items[hotbarIndex] = inv.items[fromIndex];
                    inv.items[fromIndex] = tmp;
                }

                $gameSystem._customInventoryItems = inv.items;
                $gameSystem._customHotbarItems = hotbar.items;
                inv.refresh();
                hotbar.refresh();
                return resetDragging();
            }

            // インベントリ内の移動・統合処理
            if (index >= 0 && index !== fromIndex) {
                const fromSlot = inv.items[fromIndex];
                const toSlot = inv.items[index];

                if (toSlot && fromSlot &&
                    fromSlot.id === toSlot.id &&
                    fromSlot.type === toSlot.type) {
                    const maxStack = StackSize;
                    const total = fromSlot.count + toSlot.count;

                    if (total <= maxStack) {
                        toSlot.count = total;
                        inv.items[fromIndex] = null;
                    } else {
                        toSlot.count = maxStack;
                        fromSlot.count = total - maxStack;
                    }
                } else {
                    const tmp = inv.items[index];
                    inv.items[index] = inv.items[fromIndex];
                    inv.items[fromIndex] = tmp;
                }

                $gameSystem._customInventoryItems = inv.items;
                inv.refresh();
                return resetDragging();
            }
        }

        // ▼ ホットバー → インベントリ
        if (from === "hotbar" && index >= 0 && isInventoryOpen) {
            const slot = hotbar?.items[fromIndex];
            if (!slot) return resetDragging();

            const shift = Input.isPressed("shift");
            const totalCount = slot.count || 1;
            const amount = shift ? totalCount : 1;
            let moved = 0;

            const existingSlot = inv.items[index];

            if (existingSlot &&
                existingSlot.id === slot.id &&
                existingSlot.type === slot.type &&
                existingSlot.count < StackSize
            ) {
                const space = StackSize - existingSlot.count;
                const toAdd = Math.min(space, amount);
                existingSlot.count += toAdd;
                moved += toAdd;

            } else if (!existingSlot) {
                const toAdd = Math.min(StackSize, amount);
                inv.items[index] = {
                    id: slot.id,
                    name: slot.name,
                    iconIndex: slot.iconIndex,
                    tileset: slot.tileset,
                    tileIndex: slot.tileIndex,
                    type: slot.type,
                    tileId: slot.tileId ?? 0,
                    blockName: slot.blockName ?? "",
                    count: toAdd
                };
                moved += toAdd;

            } else {
                // アイテムが異なる場合 → 入れ替えのみ（上書き防止）
                const tmp = inv.items[index];
                inv.items[index] = slot;
                hotbar.items[fromIndex] = tmp;

                $gameSystem._customInventoryItems = inv.items;
                $gameSystem._customHotbarItems = hotbar.items;
                inv.refresh();
                hotbar.refresh();
                return resetDragging();
            }

            // スタック時の個数減算
            if (totalCount > moved) {
                slot.count -= moved;
            } else {
                hotbar.items[fromIndex] = null;
            }

            $gameSystem._customInventoryItems = inv.items;
            $gameSystem._customHotbarItems = hotbar.items;
            inv.refresh();
            hotbar.refresh();
            return resetDragging();
        }


        // ホットバー → ホットバー
        if (from === "hotbar") {
            const hotbar = SceneManager._scene._hotbarWindow;

            const hx = TouchInput.x - hotbar.x - hotbar.padding;
            const hy = TouchInput.y - hotbar.y - hotbar.padding;
            const dropIndex = hotbar.hitTest(hx, hy);

            // 有効なドロップ位置なら
            if (dropIndex >= 0) {
                const fromSlot = hotbar.items[fromIndex];
                const toSlot = hotbar.items[dropIndex];

                // 同じスロットなら何もしない
                if (dropIndex === fromIndex) return resetDragging();

                // スタック可能（同ID・同タイプ）
                if (toSlot &&
                    fromSlot &&
                    toSlot.id === fromSlot.id &&
                    toSlot.type === fromSlot.type
                ) {
                    const maxStack = StackSize;
                    const total = fromSlot.count + toSlot.count;

                    if (total <= maxStack) {
                        toSlot.count = total;
                        hotbar.items[fromIndex] = null;
                    } else {
                        toSlot.count = maxStack;
                        fromSlot.count = total - maxStack;
                    }

                } else {
                    // スタック不可 → 入れ替え
                    hotbar.items[dropIndex] = fromSlot;
                    hotbar.items[fromIndex] = toSlot;
                }

                $gameSystem._customHotbarItems = hotbar.items;
                hotbar.refresh();
                return resetDragging();
            }
        }


        resetDragging();
    }





    //=============================================================================================================
    // ホットバー処理===============================================================================================
    //=============================================================================================================
    class Window_Hotbar extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this.items = [];
            this.slotCount = HotbarSlotCount;
            this.tileSize = HotbarSlotSize;
            this.margin = Hotbarmargin;
            this.selectedIndex = 0;
            this._lastClickTime = null;
            this._lastClickIndex = null;
            this.hoverCache = new Array(this.slotCount).fill(null);

            for (let i = 0; i < this.items.length; i++) {
                this.hoverCache[i] = this.items[i];
            }

            this.refresh();
            this.setupHotbarKeyListener();

            this._mouseHandlersSet = true;
        }

        maxItems() {
            return this.slotCount;
        }

        maxCols() {
            return this.slotCount;
        }

        // 行数を強制設定(1)
        maxRows() {
            return 1;
        }

        maxScrollY() {
            return 0; // スクロール不可にする
        }

        itemRect(index) {
            const totalContentWidth = this.slotCount * this.tileSize + (this.slotCount - 1) * this.margin;
            const startX = (this.contentsWidth() - totalContentWidth) / 2;
            const x = startX + index * (this.tileSize + this.margin);
            const y = 0;
            return new Rectangle(x, y, this.tileSize, this.tileSize);
        }

        refresh() {
            if (RSTH_DEBUG_LOG) console.log("[Window_Hotbar]refresh描画開始");
            this.items = $gameSystem._customHotbarItems || [];
            drawItemSlotGrid(this, this.items, this.slotCount, 1, this.tileSize, this.margin, this.selectedIndex);
            this.hoverCache = [...this.items];
        }

        canvasToLocal(event) {
            const bounds = event.target.getBoundingClientRect();
            return {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top
            };
        }

        hitTest(x, y) {
            for (let i = 0; i < this.maxItems(); i++) {
                const rect = this.itemRect(i);
                if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
                    return i;
                }
            }
            return -1;
        }

        select(index) {
            this.selectedIndex = index;

            //  抑制されているときは再描画だけ、使用処理は走らせない
            if (!this._suppressUse) {
                this.refresh();
            }
        }

        selectSlotByIndex(index) {
            if (index >= 0 && index < this.slotCount) {
                this.selectedIndex = index;
                this.refresh();
            }
        }

        selectNextSlot() {
            this.selectedIndex = (this.selectedIndex + 1) % this.slotCount;
            this.refresh();
        }

        selectPreviousSlot() {
            this.selectedIndex = (this.selectedIndex - 1 + this.slotCount) % this.slotCount;
            this.refresh();
        }

        setupHotbarKeyListener() {
            if (__hotbarKeyListenerAdded) return;
            __hotbarKeyListenerAdded = true;

            document.addEventListener("keydown", (event) => {
                const scene = SceneManager._scene;
                if (!(scene && scene._hotbarWindow)) return;

                const key = event.key;
                const hotbarWindow = scene._hotbarWindow;

                if (key >= "1" && key <= "9") {
                    const index = Number(key) - 1;
                    hotbarWindow.selectSlotByIndex(index);
                    const item = hotbarWindow.items[index];
                    hotbarWindow.setItems($gameSystem._customHotbarItems);
                    if (item) {

                        if (RSTH_DEBUG_LOG) console.log(`[[[[[hotbar_useInventoryItem]]]]]${item.name}_index${index}`);
                        useInventoryItem(item, "hotbar", index);
                    }

                } else if (key === "0") {
                    const index = 9;
                    hotbarWindow.selectSlotByIndex(index);
                    const item = hotbarWindow.items[index];
                    hotbarWindow.setItems($gameSystem._customHotbarItems);

                    if (item) {
                        if (RSTH_DEBUG_LOG) console.log(`[[[[[hotbar_useInventoryItem]]]]]${item.name}_index${index}`);
                        useInventoryItem(item, "hotbar", index);
                    }

                } else if (key === HotbarPrevKey) {
                    hotbarWindow.selectPreviousSlot();
                } else if (key === HotbarNextKey) {
                    hotbarWindow.selectNextSlot();
                }
            });
        }

        processTouch() {
            super.processTouch();

            handleSlotTouchShared(this, "hotbar", this.items, (item, index) => {
                useInventoryItem(item, "hotbar", index);
            });


            handleInventoryDragDrop(this);
        }


        canvasToLocalX(globalX) {
            return globalX - this.x - this.padding;
        }

        canvasToLocalY(globalY) {
            return globalY - this.y - this.padding;
        }

        setItems(items) {
            setItemsSafe(this, items, "_customHotbarItems");
            if (RSTH_DEBUG_LOG) console.log("[Window_Hotbar]setItemsSafe実行");

            this.refresh();
        }

        update() {
            Window_Selectable.prototype.update.call(this);
            this.updateHoverText();
        }


        updateHoverText() {
            updateHoverTextShared(this, this.items);
        }
    }


    //=============================================================================================================
    // インベントリ処理===============================================================================================
    //=============================================================================================================
    // インベントリウィンドウクラス
    class Window_Inventory extends Window_Selectable {
        // コンストラクタ内でパディングを定義
        constructor(rect) {
            super(rect);
            this.items = [];
            this.tileSize = InventorySlotSize;
            this.margin = Inventorymargin;  // アイテム間のマージン
            this._lastClickTime = null;
            this._lastClickIndex = null;
            this.hoverCache = new Array(this.maxItems()).fill(null);

            for (let i = 0; i < this.items.length; i++) {
                this.hoverCache[i] = this.items[i];
            }

            this.refresh();

            this._mouseHandlersSet = true;
            this.select(-1); // 選択を無効化（カーソル非表示）

        }

        // アイテムの数を固定
        maxItems() {
            const maxItemsSize = InventoryCols * InventoryRows;
            return maxItemsSize;
        }

        // 列数を強制設定（9列）
        maxCols() {
            return InventoryCols;
        }

        // 行数を強制設定（4行）
        maxRows() {
            return InventoryRows;
        }

        maxScrollY() {
            return 0; // スクロール不可にする
        }

        // アイテムの位置計算
        itemRect(index) {
            const col = index % this.maxCols();
            const row = Math.floor(index / this.maxCols());
            const totalContentWidth = this.maxCols() * this.tileSize + (this.maxCols() - 1) * this.margin;
            const startX = (this.contentsWidth() - totalContentWidth) / 2;
            const x = startX + col * (this.tileSize + this.margin);
            const y = row * (this.tileSize + this.margin);
            return new Rectangle(x, y, this.tileSize, this.tileSize);
        }


        // リフレッシュ
        refresh() {
            if (RSTH_DEBUG_LOG) console.log("[Window_Inventory]refresh描画開始");
            this.items = $gameSystem._customInventoryItems || [];
            drawItemSlotGrid(this, this.items, InventoryCols, InventoryRows, this.tileSize, this.margin, this.selectedIndex);
            this.hoverCache = [...this.items];
        }

        // 座標補正
        canvasToLocal(event) {
            const bounds = event.target.getBoundingClientRect();
            return {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top
            };
        }

        hitTest(x, y) {
            for (let i = 0; i < this.maxItems(); i++) {
                const rect = this.itemRect(i);
                if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
                    return i;
                }
            }
            return -1;
        }

        select(index) {
            this.selectedIndex = index;

            //  抑制されているときは再描画だけ、使用処理は走らせない
            if (!this._suppressUse) {
                this.refresh();
            }
        }

        selectSlotByIndex(index) {
            if (index >= 0 && index < this.maxItems()) {
                this.selectedIndex = index;
                this.refresh();
            }
        }

        processTouch() {
            if (!this.visible || this.openness <= 0) return;
            super.processTouch();

            handleSlotTouchShared(this, "inventory", this.items, (item, index) => {
                useInventoryItem(item, "inventory", index);
            });

            //handleInventoryDragDrop(this);
        }

        processCursorMove() { }

        canvasToLocalX(globalX) {
            return globalX - this.x - this.padding;
        }

        canvasToLocalY(globalY) {
            return globalY - this.y - this.padding;
        }

        setItems(items) {
            setItemsSafe(this, items, "_customInventoryItems");
            if (RSTH_DEBUG_LOG) console.log("[Window_Inventory]setItemsSafe実行");
            this.refresh();
        }

        update() {
            Window_Selectable.prototype.update.call(this);
            this.updateHoverText();
        }

        updateHoverText() {
            updateHoverTextShared(this, this.items);
        }
    }

    function resetDragging() {
        window.RSTH_IH.__draggingItem = null;
        window.RSTH_IH.__draggingFrom = null;
        window.RSTH_IH.__draggingIndex = null;
    }


    // キー入力でインベントリの開閉
    document.addEventListener("keydown", (event) => {
        const scene = SceneManager._scene;

        // シーンとインベントリウィンドウの存在確認
        if (!(scene instanceof Scene_Map) || !scene._inventoryWindow) return;

        const inventoryWindow = scene._inventoryWindow;

        if (event.key === "e" || event.key === "E") {
            if (inventoryWindow.visible) {
                inventoryWindow.hide();

                if (window.RSTH_IH.__popupOwner === inventoryWindow) {
                    const popup = SceneManager._scene._hoverTextSprite;
                    if (popup) {
                        popup.setText("");
                    }
                    window.RSTH_IH.__popupOwner = null;
                }
            } else {
                inventoryWindow.show();

                inventoryWindow.select(0);
                inventoryWindow.activate();
                inventoryWindow.refresh(); // ウィンドウ表示時にリフレッシュ
            }
        }
    });

    Window_Inventory.prototype.hide = function () {
        Window_Selectable.prototype.hide.call(this);

        if (window.RSTH_IH.__popupOwner === this) {
            const popup = SceneManager._scene._hoverTextSprite;
            if (popup) popup.setText("");
            window.RSTH_IH.__popupOwner = null;
        }
    };

    window.RSTH_IH.__popupOwner = null;

    //=============================================================================================================
    // ウィンドウ生成処理等===============================================================================================
    //=============================================================================================================
    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function () {
        _Scene_Map_createAllWindows.call(this);

        const hotbarPos = calculateHotbarPosition();
        const invPos = calculateInventoryPosition(hotbarPos.x, hotbarPos.y);

        // ホットバー
        if (typeof Window_Hotbar !== "undefined" && !this._hotbarWindow) {
            const rect = new Rectangle(hotbarPos.x, hotbarPos.y, Hotbarwidth, Hotbarheight);
            this._hotbarWindow = new Window_Hotbar(rect);
            this.addWindow(this._hotbarWindow);
            this._hotbarWindow.activate();
        }

        // インベントリ
        if (typeof Window_Inventory !== "undefined" && !this._inventoryWindow) {
            const rect = new Rectangle(invPos.x, invPos.y, Inventorywidth, Inventoryheight);
            this._inventoryWindow = new Window_Inventory(rect);
            this.addWindow(this._inventoryWindow);
            this._inventoryWindow.hide();
            this._inventoryWindow.deactivate();
        }

        // プレイヤーのアイテムとホットバー状態を復元
        this._inventoryWindow.refresh();

        if ($gameSystem._customHotbarItems) {
            this._hotbarWindow.setItems($gameSystem._customHotbarItems);
        }

        this._windowLayer.removeChild(this._inventoryWindow);
        this._windowLayer.removeChild(this._hotbarWindow);

        this._windowLayer.addChildAt(this._inventoryWindow, 0);
        this._windowLayer.addChildAt(this._hotbarWindow, 0);



        this._hoverTextSprite = new Sprite_PopupText();
        this.addChild(this._hoverTextSprite);

        // 初回アイテム更新
        this.updateInventoryAndHotbar();
    };

    Scene_Map.prototype.updateInventoryAndHotbar = function () {
        if (window.RSTH_IH.__draggingItem) return;

        const inv = this._inventoryWindow;
        const hotbar = this._hotbarWindow;

        const inventoryItems = $gameSystem._customInventoryItems || [];
        const hotbarItems = $gameSystem._customHotbarItems || [];

        inv.setItems(inventoryItems);
        hotbar.setItems(hotbarItems);
    };

    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _Game_System_initialize.call(this);
        const maxInv = InventoryCols * InventoryRows;
        const maxHot = 10;
        this._customInventoryItems = Array(maxInv).fill(null);
        this._customHotbarItems = Array(maxHot).fill(null);
    };






    // ==============================
    // ▼ アイテム使用処理
    // ==============================

    function useInventoryItem(item, source = "inventory", slotIndex = null) {


        const scene = SceneManager._scene;
        const inv = scene?._inventoryWindow;
        const hotbar = scene?._hotbarWindow;
        if (!item) return;

        const dataItem = getGameItem(item);
        if (!dataItem) return;

        const actor = $gameParty.leader();

        if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]item.type: ${item.type}`);


        // ▼ ブロックなら設置処理
        if (item.type === "block") {
            const tileId = Number(item.tileId || 0);

            if (tileId > 0) {
                let [x, y] = getFrontTileXY(item.id);

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]item`, item);
                const gameItem = getGameItem(item);

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
                    const px = x + dx;
                    const py = y + dy;


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
                }



                // ブロックが未設置の場合のみ設置
                if (canPlaceBlockAt(x, y, gameItem)) {
                    const itemId = item.id;
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]ブロック設置: (${x}, ${y}) → tileId ${tileId}, itemId ${itemId}`);




                    // ブロック設置
                    window.RSTH_IH.SurvivalBlockManager.place(x, y, itemId);

                    // 追加されたブロック群から、中心ブロック（originX/Yと一致）を取得
                    const placedBlocks = window.RSTH_IH.SurvivalBlockManager._blocks;
                    const rootBlock = placedBlocks.find(b => b.originX === x && b.originY === y && b.growthStage === 0);

                    // growthTimeがあれば、そこに記録（必要ならブロック構造を拡張）
                    if (item.growthTime && rootBlock) {
                        rootBlock.growthTime = Number(item.growthTime); // ← 保存用（将来セーブ対象にするなら必要）
                        $gameSystem.rsthstartGrowthTimer(rootBlock.x, rootBlock.y, rootBlock.growthTime);
                    }


                    if (RSTH_DEBUG_LOG) console.log("[canPlaceBlockAt]$gameSystem._rsthPlacedFurniture", $gameSystem._rsthPlacedFurniture)


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
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]設置不可: (${x}, ${y}) にはすでにブロックが存在`);
                    return;
                }
            }
        }


        if (item.type === "tool") {
            const gameItem = getGameItem(item);
            if (isToolWeapon(gameItem)) {
                const [x, y] = getFrontTileXY(item.id);

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][tool]x ${x} y ${y}`);

                const block = window.RSTH_IH.SurvivalBlockManager.get(x, y);

                if (!block) {
                    if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][tool]block is null or undifined`);
                    return;
                }

                if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem][tool]block?`, block);


                const originX = block.originX ?? block.x;
                const originY = block.originY ?? block.y;
                const originBlock = window.RSTH_IH.SurvivalBlockManager.get(originX, originY);
                if (!originBlock) return;

                const effective = getEffectiveBlocks(gameItem);
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
            __Vanilla_GainItem(dataItem, 1, true);

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
                        if (!ok) {
                            if (RSTH_DEBUG_LOG) console.warn("[useInventoryItem][isArmor] rollback発動：古い装備を戻せない");
                            rollback = true;
                        }
                    }
                }

                if (rollback) {
                    if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor][rollback処理] 新装備を削除し、装備を戻す");
                    window.RSTH_IH.removeItemFromInventoryOrHotbar(dataItem, 1);
                    __Vanilla_GainItem(dataItem, -1, false);
                    __Vanilla_GainItem(removed, 1, false);
                    actor.changeEquip(slotId, removed);
                    __Vanilla_GainItem(removed, -1, false);
                    scene.updateInventoryAndHotbar();
                    SceneManager._scene._inventoryWindow.refresh();
                    SceneManager._scene._hotbarWindow.refresh();
                    return;
                }

                if (RSTH_DEBUG_LOG) console.log("[useInventoryItem][isArmor] 装備成功 → 新装備を $gameParty から削除");
                __Vanilla_GainItem(dataItem, -1, false);
                SoundManager.playEquip();

                // ▼ ここで最新のlist再取得とindex再検索
                const updatedList = (source === "inventory") ? $gameSystem._customInventoryItems : $gameSystem._customHotbarItems;
                const updatedIndex = updatedList?.findIndex(slot => slot && slot.id === dataItem.id && slot.type === getItemType(dataItem));
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
            __Vanilla_GainItem(dataItem, -1, false);
            scene.updateInventoryAndHotbar();
            return;
        }

        // 武器なら装備処理（アイテム使用ではなく）
        if (DataManager.isWeapon(dataItem)) {
            if (!EnableWeaponEquip) return; // ← 武器装備をできなくした場合はreturnする
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

            __Vanilla_GainItem(dataItem, 1, true);  // 一時追加
            actor.changeEquip(slotId, dataItem);
            const equipped = actor.equips()[slotId];

            if (equipped !== dataItem) {
                __Vanilla_GainItem(dataItem, -1, false);  // ロールバック
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
                    __Vanilla_GainItem(dataItem, -1, false);
                    __Vanilla_GainItem(removed, -1, false);
                    scene.updateInventoryAndHotbar();
                    return;
                }
            }

            __Vanilla_GainItem(dataItem, -1, false);
            SoundManager.playEquip();

            const updatedList = (source === "inventory") ? $gameSystem._customInventoryItems : $gameSystem._customHotbarItems;
            const updatedIndex = updatedList?.findIndex(slot => slot && slot.id === dataItem.id && slot.type === getItemType(dataItem));
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


        //if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]2 プレイヤー移動ロック状態: $gamePlayer.canMove()=${$gamePlayer.canMove()}`);

        if (source === "hotbar") {
            const list = hotbar?.items;
            const index = slotIndex ?? list?.findIndex(slot => slot && slot.id === item.id && slot.type === item.type);
            if (index < 0) return;

            const slot = list[index];

            if (!slot) return; // ★ null 安全チェック
            __Vanilla_GainItem(dataItem, 1, false);

            if (actor.canUse(dataItem)) {
                const action = new Game_Action(actor);
                action.setItemObject(dataItem);
                const targets = action.makeTargets();
                for (const target of targets) action.apply(target);
                __Vanilla_GainItem(dataItem, -1, false);

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
            //if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]3 プレイヤー移動ロック状態: $gamePlayer.canMove()=${$gamePlayer.canMove()}`);

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

            //if (RSTH_DEBUG_LOG) console.log(`[useInventoryItem]4 プレイヤー移動ロック状態: $gamePlayer.canMove()=${$gamePlayer.canMove()}`);
            return;
        }
    }

    (function () {
        const _canMove = Game_Player.prototype.canMove;
        Game_Player.prototype.canMove = function () {
            const result = _canMove.call(this);
            if (RSTH_DEBUG_LOG) {
                const hasInventoryWindow = !!(SceneManager._scene && SceneManager._scene._inventoryWindow);
                //console.log(`[canMove] result=${result}, inventoryWindowExists=${hasInventoryWindow}`);
            }
            return result;
        };
    })();



    // アイテムを挿入できるスロット位置（index）を返す関数
    window.RSTH_IH.findInsertSlot = function (slots, item, count = 1) {
        const type = (() => {
            if (DataManager.isItem(item)) return "item";
            if (DataManager.isWeapon(item)) return "weapon";
            if (DataManager.isArmor(item)) return "armor";
            return "unknown";
        })();

        // スタック可能なスロットを探す
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count + count <= StackSize) {
                return i;
            }
        }

        // 空きスロットを探す
        for (let i = 0; i < slots.length; i++) {
            if (!slots[i]) return i;
        }

        return -1; // 見つからなかった場合
    };



    // インベントリに空きが1以上あるかどうか
    window.RSTH_IH.canInsertToInventory = function (item, count = 1) {
        const slots = $gameSystem._customInventoryItems || [];
        return window.RSTH_IH.findInsertSlot(slots, item, count) >= 0;
    };

    // ホットバーに空きが1以上あるかどうか
    window.RSTH_IH.canInsertToHotbar = function (item, count = 1) {
        const slots = $gameSystem._customHotbarItems || [];
        return window.RSTH_IH.findInsertSlot(slots, item, count) >= 0;
    };

    // インベントリ、ホットバーが満杯の時に、メニューの装備欄から防具を外した場合の処理
    const _Game_Actor_changeEquip = Game_Actor.prototype.changeEquip;
    Game_Actor.prototype.changeEquip = function (slotId, item) {
        const oldItem = this.equips()[slotId];

        // RSTH制御：装備を外す場合のみ（item == null）
        if (!item && oldItem && typeof window.RSTH_IH !== "undefined") {
            const canAddToInv = window.RSTH_IH.canInsertToInventory(oldItem, 1);
            const canAddToHotbar = window.RSTH_IH.canInsertToHotbar(oldItem, 1);
            if (!canAddToInv && !canAddToHotbar) {
                if (RSTH_DEBUG_LOG) console.warn("[_Game_Actor_changeEquip] 装備を外せません：インベントリとホットバーが満杯");
                SoundManager.playBuzzer(); // 任意：音を鳴らす
                return; // 装備解除キャンセル
            }
        }

        // 通常の処理へ
        _Game_Actor_changeEquip.call(this, slotId, item);
    };

    // 指定アイテムがインベントリまたはホットバーに存在するか
    window.RSTH_IH.hasItem = function (item) {
        if (!item) return false;
        const type = getItemType(item);
        const inv = $gameSystem._customInventoryItems || [];
        const hot = $gameSystem._customHotbarItems || [];

        const existsInInv = inv.some(slot => slot && slot.id === item.id && slot.type === type);
        const existsInHot = hot.some(slot => slot && slot.id === item.id && slot.type === type);

        return existsInInv || existsInHot;
    };

    function canPlaceBlockAt(x, y, item) {
        //if (RSTH_DEBUG_LOG) console.log(`[canPlaceBlockAt]item${item}, item.meta${item.meta}, item.meta.tileOffsets${item.meta.tileOffsets}`);

        if (RSTH_DEBUG_LOG) console.log(`[canPlaceBlockAt]item`, item, `item.meta`, item.meta);

        if (!item || !item.meta || !item.meta.tileOffsets1) return false;

        if (RSTH_DEBUG_LOG) console.log("[canPlaceBlockAt]not return false");
        try {
            if (RSTH_DEBUG_LOG) console.log("[canPlaceBlockAt]try");
            const tileOffsets = JSON.parse(item.meta.tileOffsets1);
            return tileOffsets.every(offset => {
                const px = x + (offset.dx || 0);
                const py = y + (offset.dy || 0);
                return !window.RSTH_IH.SurvivalBlockManager.get(px, py);
            });
        } catch (e) {
            if (RSTH_DEBUG_LOG) console.log("[canPlaceBlockAt]catch (e)");
            if (RSTH_DEBUG_LOG) console.log(`[canPlaceBlockAt] (${x}, ${y}) には既にブロックがあります`);
            return false;
        }
    }




})();