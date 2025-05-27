/*:
 * @target MZ
 * @plugindesc RSTH_EquipmentUI: 装備ウィンドウを追加するプラグイン ver1.0.2
 * @author ReSera_りせら
 *
 * @help
 * このプラグインは、通常の装備画面とは別に、マップ画面上で装備の一覧
 * を確認通常の装備画面とは別に、マップ画面上で装備の一覧を確認・変更できる
 * ウィンドウを表示し、マウス操作で装備を外したり確認したりできます。
 * 
 * - RSTH_IH(インベントリやホットバー)との連携必須
 * - ダブルクリックで装備を外す
 * - 装備アイコンを表示
 * - ウィンドウの位置や開閉キーをプラグインパラメータから設定可能
 * 
 * ▼ 使用方法
 * プロジェクトの「js/plugins」フォルダにこのファイルを追加し、
 * プラグインマネージャーから有効にしてください。
 * 開閉キーはデフォルトで「E」キーです（設定可）。
 * 
 * ▼ 注意事項
 * - RSTH_IH（インベントリ、ホットバー追加プラグイン）との連携を前提としています。
 * - RSTH_IHの後に配置してください。
 * - 他の装備管理プラグインとの併用は動作を保証しません。
 * - グローバル汚染を避けるため、window.RSTH_IH 名前空間を使用しています。
 * 
 * ▼ ライセンス
 * このプラグインは MITライセンス の下で公開されています。
 * 
 * ----------------------------
 * 変更履歴:
 * ----------------------------
 * 
 * Ver.1.0.2 - 2025/05/27
 *     RSTH_DEBUG_LOG がtrueの場合のみこのファイルのコンソールログを出力するように修正
 * 
 * Ver.1.0.1 - 2025/05/26
 *   - 細かい修正を実施
 * 
 * Ver.1.0.0 - 2025/05/25
 *   - 初版公開
 * 
 * @param RSTH_EquipmentUI_SLOT_SIZE
 * @text スロットサイズ（px）
 * @type number
 * @default 32
 * @desc 各装備スロットの1マスのサイズ（ピクセル単位）

 * @param RSTH_EquipmentUI_EQUIP_INDICES
 * @text 装備スロット番号配列
 * @type number[]
 * @default ["1","2","3","4"]
 * @desc 対象とする装備スロットの番号配列（武器=0、盾=1、頭=2...）
 *
 * @param RSTH_EquipmentUI_Position
 * @text 装備ウィンドウの位置
 * @type select
 * @option topleft
 * @option topright
 * @option bottomleft
 * @option bottomright
 * @default bottomleft
 * @desc 装備ウィンドウを表示する画面の位置
 * @param RSTH_EquipmentUI_ToggleKey
 * @text 装備ウィンドウ開閉キー
 * @type string
 * @default e
 * @desc 装備ウィンドウの表示／非表示を切り替えるキー（小文字）
 */

(() => {
    "use strict";

    //プラグインパラメータ用グローバル変数
    const p = PluginManager.parameters("RSTH_EquipmentUI") || {};
    const SLOT_SIZE = Number(p["RSTH_EquipmentUI_SLOT_SIZE"] || 32); // スロット1つのサイズ
    const EQUIP_POSITION = p["RSTH_EquipmentUI_Position"] || "bottomleft";
    const TOGGLE_KEY = (p["RSTH_EquipmentUI_ToggleKey"] || "e").toLowerCase();

    // 装備スロット配列の変換（string[] → number[]）
    const EQUIP_INDICES = JSON.parse(p["RSTH_EquipmentUI_EQUIP_INDICES"] || "[1,2,3,4]").map(Number);

    const SLOT_MARGIN = 8;

    window.RSTH_IH = window.RSTH_IH || {};

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    const RSTH_DEBUG_LOG = false;

    // 初期化時に指定キーを仮想アクション "toggleEquipment" に割り当て
    Input.keyMapper = Input.keyMapper || {};
    Input.keyMapper[TOGGLE_KEY.toUpperCase().charCodeAt(0)] = "toggleEquipment";

    class Window_EquipmentSlots extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this._slotIndices = EQUIP_INDICES; // ← ここで保存
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
            const y = index * (SLOT_SIZE + SLOT_MARGIN);
            const width = SLOT_SIZE;
            const height = SLOT_SIZE;
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

                const scale = SLOT_SIZE / 32;
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
            const slotId = EQUIP_INDICES[index];
            const actor = this._actor;
            const item = actor.equips()[slotId];
            if (!item) return;

            const dbItem = DataManager.isArmor(item) ? $dataArmors[item.id]
                : DataManager.isWeapon(item) ? $dataWeapons[item.id]
                    : DataManager.isItem(item) ? $dataItems[item.id]
                        : null;
            if (!dbItem) return;

            // ✅ インベントリとホットバーに空きがあるか確認
            if (!window.RSTH_IH.hasFreeSpaceForItem(dbItem)) {
                SoundManager.playBuzzer();
                if (RSTH_DEBUG_LOG) console.warn("[RSTH] 防具を外せません：インベントリもホットバーも満杯です");
                return;
            }

            // ✅ actor.changeEquip により自動的に $gameParty.gainItem() が呼ばれる（RSTHによりインベントリに移動される）
            actor.changeEquip(slotId, null);

            SoundManager.playEquip();
            this.refresh();
            if (SceneManager._scene?.updateInventoryAndHotbar) {
                SceneManager._scene.updateInventoryAndHotbar();
            }
        }




        updateHoverText() {
            if (!this.visible || !this._actor) return;

            const popup = SceneManager._scene?._hoverTextSprite;
            if (!popup) return;

            const x = TouchInput.x - this.x - this.padding;
            const y = TouchInput.y - this.y - this.padding;
            const index = this.hitTest(x, y);

            if (index >= 0) {
                const slotId = EQUIP_INDICES[index];
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

    Window_EquipmentSlots.prototype.processCursorMove = function () {
        // キー入力による選択移動を無効化
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        this.RSTH_IH_updateToggleEquipmentWindow();
    };

    Scene_Map.prototype.RSTH_IH_updateToggleEquipmentWindow = function () {
        if (!this._equipmentWindow) return;

        // キー押下時にトグル
        if (Input.isTriggered("toggleEquipment")) {
            if (this._equipmentWindow.visible) {
                this._equipmentWindow.hide();
                this._equipmentWindow.deactivate();
            } else {
                this._equipmentWindow.show();
                this._equipmentWindow.activate();
            }
        }
    };

    // Scene_Map に装備ウィンドウを追加
    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function () {
        _Scene_Map_createAllWindows.call(this);
        this.RSTH_IH_createEquipmentWindow();

    };

    Scene_Map.prototype.RSTH_IH_createEquipmentWindow = function () {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        const w = SLOT_SIZE + SLOT_MARGIN * 3;
        const h = (SLOT_SIZE + SLOT_MARGIN) * EQUIP_INDICES.length + SLOT_MARGIN * 2;

        let x = 0;
        let y = 0;

        switch (EQUIP_POSITION) {
            case "topleft":
                x = 20;
                y = 20;
                break;
            case "topright":
                x = gw - w - 20;
                y = 20;
                break;
            case "bottomleft":
                x = 20;
                y = gh - h - 20;
                break;
            case "bottomright":
                x = gw - w - 20;
                y = gh - h - 20;
                break;
        }

        this._equipmentWindow = new Window_EquipmentSlots(new Rectangle(x, y, w, h));
        this.addWindow(this._equipmentWindow);

        this._equipmentWindow.hide();
        this._equipmentWindow.deactivate();
    };

})();
