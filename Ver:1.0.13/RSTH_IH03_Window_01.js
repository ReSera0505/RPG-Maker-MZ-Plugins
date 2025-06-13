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
    // ホットバー処理===============================================================================================
    //=============================================================================================================
    window.RSTH_IH.Window_Hotbar = class extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this.items = [];
            this.slotCount = window.RSTH_IH.HotbarSlotCount;
            this.tileSize = window.RSTH_IH.HotbarSlotSize;
            this.margin = window.RSTH_IH.Hotbarmargin;
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

        processCursorMove() { }

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
            const y = this.margin / 2;
            return new Rectangle(x, y, this.tileSize, this.tileSize);
        }

        refresh() {
            if (RSTH_DEBUG_LOG) console.log("[Window_Hotbar]refresh描画開始");
            this.items = $gameSystem._customHotbarItems || [];
            window.RSTH_IH.drawItemSlotGrid(this, this.items, this.slotCount, 1, this.tileSize, this.margin, this.selectedIndex, true);
            this.hoverCache = [...this.items];
            if (SceneManager._scene?._rsthCursorSprite && SceneManager._scene.updateCursorForSlot && this.selectedIndex >= 0) {
                SceneManager._scene.updateCursorForSlot(this.selectedIndex, this);
            }


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
            window.RSTH_IH.HobarSlotsIndex = index;

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
            window.RSTH_IH.HobarSlotsIndex = this.selectedIndex;
            this.refresh();
        }

        selectPreviousSlot() {
            this.selectedIndex = (this.selectedIndex - 1 + this.slotCount) % this.slotCount;
            window.RSTH_IH.HobarSlotsIndex = this.selectedIndex;
            this.refresh();
        }

        setupHotbarKeyListener() {
            if (window.RSTH_IH.__hotbarKeyListenerAdded) return;
            window.RSTH_IH.__hotbarKeyListenerAdded = true;

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
                        window.RSTH_IH.HobarSlotsIndex = index;
                    }

                } else if (key === "0") {
                    const index = 9;
                    hotbarWindow.selectSlotByIndex(index);
                    const item = hotbarWindow.items[index];
                    hotbarWindow.setItems($gameSystem._customHotbarItems);

                    if (item) {
                        window.RSTH_IH.HobarSlotsIndex = index;
                    }

                } else if (key === window.RSTH_IH.HotbarPrevKey) {
                    hotbarWindow.selectPreviousSlot();
                } else if (key === window.RSTH_IH.HotbarNextKey) {
                    hotbarWindow.selectNextSlot();
                }
            });
        }

        processTouch() {
            super.processTouch();

            window.RSTH_IH.handleSlotTouchShared(this, "hotbar", this.items, (item, index) => {
                window.RSTH_IH.useInventoryItem(item, "hotbar", index);
            });


            window.RSTH_IH.handleInventoryDragDrop(this);
        }

        canvasToLocalX(globalX) {
            return globalX - this.x - this.padding;
        }

        canvasToLocalY(globalY) {
            return globalY - this.y - this.padding;
        }

        setItems(items) {
            window.RSTH_IH.setItemsSafe(this, items, "_customHotbarItems");
            if (RSTH_DEBUG_LOG) console.log("[Window_Hotbar]setItemsSafe実行");

            this.refresh();
        }

        update() {
            Window_Selectable.prototype.update.call(this);
            this.updateHoverText();
            this.updateWheelScroll();

        }

        updateWheelScroll() {
            if (!this.active || !this.visible || !this.open) return;

            const scene = SceneManager._scene;
            if (!(scene && scene._hotbarWindow)) return;
            const threshold = 1;
            const dy = TouchInput.wheelY;
            const hotbarWindow = scene._hotbarWindow;

            if (dy >= threshold) {
                hotbarWindow.selectPreviousSlot();
                TouchInput._wheelY = 0;
            } else if (dy <= -threshold) {
                hotbarWindow.selectNextSlot();
                TouchInput._wheelY = 0;
            }
        }


        updateHoverText() {
            window.RSTH_IH.updateHoverTextShared(this, this.items);
        }
    }

    //=============================================================================================================
    // インベントリ処理===============================================================================================
    //=============================================================================================================
    window.RSTH_IH.Window_Inventory = class extends Window_Selectable {
        // コンストラクタ内でパディングを定義
        constructor(rect) {
            super(rect);
            this.items = [];
            this.tileSize = window.RSTH_IH.InventorySlotSize;
            this.margin = window.RSTH_IH.Inventorymargin;  // アイテム間のマージン
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
            const maxItemsSize = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows;
            return maxItemsSize;
        }

        // 列数を強制設定（9列）
        maxCols() {
            return window.RSTH_IH.InventoryCols;
        }

        // 行数を強制設定（4行）
        maxRows() {
            return window.RSTH_IH.InventoryRows;
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
            const y = row * (this.tileSize + this.margin) + this.margin / 2;
            return new Rectangle(x, y, this.tileSize, this.tileSize);
        }


        // リフレッシュ
        refresh() {
            if (RSTH_DEBUG_LOG) console.log("[Window_Inventory]refresh描画開始");
            this.items = $gameSystem._customInventoryItems || [];
            window.RSTH_IH.drawItemSlotGrid(this, this.items, window.RSTH_IH.InventoryCols, window.RSTH_IH.InventoryRows, this.tileSize, this.margin, this.selectedIndex);
            this.hoverCache = [...this.items];

            const scene = SceneManager._scene;
            const sprite = scene?._rsthCursorSprite;

            if (sprite) {
                if (!this.visible || this.openness <= 0 || this.selectedIndex < 0) {
                    // 非表示条件：ウィンドウ非表示、閉じかけ、選択なし
                    sprite.visible = false;
                } else if (scene.updateCursorForSlot) {
                    // 通常更新
                    scene.updateCursorForSlot(this.selectedIndex, this);
                }
            }


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

            window.RSTH_IH.handleSlotTouchShared(this, "inventory", this.items, (item, index) => {
                window.RSTH_IH.useInventoryItem(item, "inventory", index);
            });

        }

        processCursorMove() { }

        canvasToLocalX(globalX) {
            return globalX - this.x - this.padding;
        }

        canvasToLocalY(globalY) {
            return globalY - this.y - this.padding;
        }

        setItems(items) {
            window.RSTH_IH.setItemsSafe(this, items, "_customInventoryItems");
            if (RSTH_DEBUG_LOG) console.log("[Window_Inventory]setItemsSafe実行");
            this.refresh();
        }

        update() {
            Window_Selectable.prototype.update.call(this);
            this.updateHoverText();
        }

        updateHoverText() {
            window.RSTH_IH.updateHoverTextShared(this, this.items);
        }
    }


    window.RSTH_IH.Window_Inventory.prototype.hide = function () {
        Window_Selectable.prototype.hide.call(this);

        if (window.RSTH_IH.__popupOwner === this) {
            const popup = SceneManager._scene._hoverTextSprite;
            if (popup) popup.setText("");
            window.RSTH_IH.__popupOwner = null;
        }
        if (SceneManager._scene?._rsthCursorSprite) {
            SceneManager._scene._rsthCursorSprite.visible = false;
        }

    };


    //=============================================================================================================
    // 装備ウィンドウ処理===============================================================================================
    //=============================================================================================================

    window.RSTH_IH.Window_EquipmentSlots = class extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this._slotIndices = window.RSTH_IH.EQUIP_INDICES;
            this.setActor($gameParty.leader());
            this.refresh();
            this._hoverIndex = -1;
            this.select(-1); // ← 初期状態で選択なし
            this.setCursorFixed(true); // ← カーソル移動無効化
            this.setCursorAll(false);  // ← 全体カーソルも無効化

        }

        setActor(actor) {
            this._actor = actor;
        }

        maxItems() {
            return this._slotIndices.length;
        }


        maxScrollY() {
            return 0; // スクロール不可にする
        }

        itemRect(index) {
            const x = 0;
            const y = index * (window.RSTH_IH.EQUIP_SLOT_SIZE + window.RSTH_IH.Eqslotmargin);
            const width = window.RSTH_IH.EQUIP_SLOT_SIZE;
            const height = window.RSTH_IH.EQUIP_SLOT_SIZE;
            return new Rectangle(x, y, width, height);
        }

        drawCursorRect(index) {
            // カーソル描画なし
        }

        drawItem(index) {
            const rect = this.itemRect(index);
            this.contents.strokeRect(rect.x, rect.y, rect.width, rect.height, "white");

            const slotId = this._slotIndices[index];
            const item = this._actor.equips()[slotId];
            if (item) {
                const iconSet = ImageManager.loadSystem("IconSet");
                const pw = 32, ph = 32;
                const sx = item.iconIndex % 16 * pw;
                const sy = Math.floor(item.iconIndex / 16) * ph;

                const scale = window.RSTH_IH.EQUIP_SLOT_SIZE / 32;
                const dw = pw * scale;
                const dh = ph * scale;
                const dx = rect.x + (rect.width - dw) / 2;
                const dy = rect.y + (rect.height - dh) / 2;

                this.contents.blt(iconSet, sx, sy, pw, ph, dx, dy, dw, dh);
            }
        }


        refresh() {
            this.contents.clear();
            for (let i = 0; i < this.maxItems(); i++) {
                this.drawItem(i);
            }
        }

        // ヒットしたスロットインデックスを返す
        hitTest(x, y) {
            for (let i = 0; i < this.maxItems(); i++) {
                const rect = this.itemRect(i);
                if (x >= rect.x && x < rect.x + rect.width &&
                    y >= rect.y && y < rect.y + rect.height) {
                    return i;
                }
            }
            return -1;
        }

        update() {
            super.update();
            this.processTouch();
            this.updateHoverText();
        }

        processTouch() {
            if (TouchInput.isTriggered()) {
                this._clickTime = performance.now();
                this._clickIndex = this.hitTest(
                    TouchInput.x - this.x - this.padding,
                    TouchInput.y - this.y - this.padding
                );
            }

            if (TouchInput.isReleased() && this._clickIndex >= 0) {
                const index = this.hitTest(
                    TouchInput.x - this.x - this.padding,
                    TouchInput.y - this.y - this.padding
                );
                if (index === this._clickIndex) {
                    const now = performance.now();
                    if (this._lastClickTime && now - this._lastClickTime < 300 && index === this._lastClickIndex) {
                        this.onDoubleClick(index);
                        this._lastClickTime = 0;
                        this._lastClickIndex = -1;
                    } else {
                        this._lastClickTime = now;
                        this._lastClickIndex = index;
                    }
                }
                this._clickIndex = -1;
            }
        }


        onDoubleClick(index) {
            const slotId = window.RSTH_IH.EQUIP_INDICES[index];
            const actor = this._actor;
            const item = actor.equips()[slotId];
            if (!item) return;

            const dbItem = DataManager.isArmor(item) ? $dataArmors[item.id]
                : DataManager.isWeapon(item) ? $dataWeapons[item.id]
                    : DataManager.isItem(item) ? $dataItems[item.id]
                        : null;
            if (!dbItem) return;

            // インベントリとホットバーに空きがあるか確認
            if (!window.RSTH_IH.hasFreeSpaceForItem(dbItem)) {
                SoundManager.playBuzzer();
                if (RSTH_DEBUG_LOG) console.warn("[RSTH] 防具を外せません：インベントリもホットバーも満杯です");
                return;
            }

            // actor.changeEquip により自動的に $gameParty.gainItem() が呼ばれる（RSTHによりインベントリに移動される）
            actor.changeEquip(slotId, null);

            SoundManager.playEquip();
            this.refresh();
            if (SceneManager._scene?.updateInventoryAndHotbar) {
                SceneManager._scene.updateInventoryAndHotbar();
            }
        }

        processCursorMove() {
            // キー入力による選択移動を無効化
        }


        updateHoverText() {
            if (!this.visible || !this._actor) return;

            const popup = SceneManager._scene?._hoverTextSprite;
            if (!popup) return;

            const x = TouchInput.x - this.x - this.padding;
            const y = TouchInput.y - this.y - this.padding;
            const index = this.hitTest(x, y);

            if (index >= 0) {
                const slotId = window.RSTH_IH.EQUIP_INDICES[index];
                const item = this._actor.equips()[slotId];
                const name = item ? item.name : "";

                if (popup._text !== name) {
                    popup.setText(name);
                }

                window.RSTH_IH.__popupOwner = this;
            } else if (window.RSTH_IH.__popupOwner === this) {
                popup.setText("");
                window.RSTH_IH.__popupOwner = null;
            }
        }



    }









})();