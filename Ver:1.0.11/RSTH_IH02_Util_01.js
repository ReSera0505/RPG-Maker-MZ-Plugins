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

    window.RSTH_IH.tilesetConfigs = JSON.parse(window.RSTH_IH.tilesetConfigsRaw).map(json => {
        const cfg = JSON.parse(json);
        return {
            name: cfg.name || "Inside_C",
            tileSize: Number(cfg.tileSize || 48),
            cols: Number(cfg.cols || 16)
        };
    });

    window.RSTH_IH.getTilesetConfigByName = function (name) {
        return window.RSTH_IH.tilesetConfigs.find(cfg => cfg.name === name) || {
            name: name,
            tileSize: 48,
            cols: 16
        };
    }

    // 右クリックでメニューを開かせない。
    Scene_Map.prototype.isMenuCalled = function () { return Input.isTriggered("menu"); };

    // WASDキー登録
    Input.keyMapper = Object.assign(Input.keyMapper, {
        87: "w", // W
        65: "a", // A
        83: "s", // S
        68: "d"  // D
    });

    // マウスクリックによる移動を封印
    Game_Temp.prototype.setDestination = function (x, y) { };    // 空実装にして無効化

    // マップタッチ処理を封印（クリック移動を補完している処理）
    Scene_Map.prototype.processMapTouch = function () { };  // 無効化

    // 平行移動とwasdキーでの移動
    (function () {
        const _Game_Player_moveByInput = Game_Player.prototype.moveByInput;
        Game_Player.prototype.moveByInput = function () {
            if (!this.canMove() || this.isMoving()) return;

            const scene = SceneManager._scene;
            if (scene && scene._chestWindow?.visible || scene._workbenchWindow?.visible) {
                return; // 入力による移動だけ無効化
            }

            // WASDと矢印キーに対応した入力検出
            let horz = 0;
            let vert = 0;

            if (Input.isPressed("right") || Input.isPressed("d")) horz = 6;
            else if (Input.isPressed("left") || Input.isPressed("a")) horz = 4;

            if (Input.isPressed("down") || Input.isPressed("s")) vert = 2;
            else if (Input.isPressed("up") || Input.isPressed("w")) vert = 8;

            // control押下中 → 平行移動（方向は変えずに移動）
            if (Input.isPressed("control") && (horz || vert)) {
                if (horz && vert && this.canPassDiagonally(this.x, this.y, horz, vert)) {
                    const originalDirection = this.direction();
                    this.moveDiagonally(horz, vert);
                    this.setDirection(originalDirection);
                } else {
                    const dir = horz || vert;
                    if (this.canPass(this.x, this.y, dir)) {
                        const originalDirection = this.direction();
                        this.moveStraight(dir);
                        this.setDirection(originalDirection);
                    }
                }
                return;
            }


            // controlなし：斜め移動優先
            if (horz && vert) {
                this.moveDiagonally(horz, vert);
                return;
            }

            if (horz) {
                this.moveStraight(horz);
                return;
            }

            if (vert) {
                this.moveStraight(vert);
                return;
            }

            // タッチ・マウス入力対応
            _Game_Player_moveByInput.call(this);
        };
    })();

    // ▼ 共通関数：スロット情報 → 実データ
    window.RSTH_IH.getGameItem = function (item) {
        if (item.type === "item") return $dataItems[item.id];
        if (item.type === "weapon") return $dataWeapons[item.id];
        if (item.type === "armor") return $dataArmors[item.id];
        if (item.type === "block") return $dataItems[item.id];
        if (item.type === "tool") return $dataWeapons[item.id];
        return null;
    }


    // ホットバーの位置の設定
    window.RSTH_IH.calculateHotbarPosition = function () {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        let x = 0;
        let y = 0;

        switch (window.RSTH_IH.HotbarPosition) {
            case "topleft":
                x = 20;
                y = 20;
                break;
            case "top":
                x = (gw - window.RSTH_IH.Hotbarwidth) / 2;
                y = 20;
                break;
            case "topright":
                x = gw - window.RSTH_IH.Hotbarwidth - 20;
                y = 20;
                break;
            case "bottomleft":
                x = 20;
                y = gh - window.RSTH_IH.Hotbarheight - 20;
                break;
            case "bottom":
                x = (gw - window.RSTH_IH.Hotbarwidth) / 2;
                y = gh - window.RSTH_IH.Hotbarheight - 20;
                break;
            case "bottomright":
                x = gw - window.RSTH_IH.Hotbarwidth - 20;
                y = gh - window.RSTH_IH.Hotbarheight - 20;
                break;
        }

        return { x, y };
    }

    // インベントリの位置を設定
    window.RSTH_IH.calculateInventoryPosition = function (hotbarX, hotbarY) {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        const below = window.RSTH_IH.HotbarPosition.startsWith("top"); // 上にあるホットバーなら下に表示
        const invX = hotbarX + (window.RSTH_IH.Hotbarwidth - window.RSTH_IH.Inventorywidth) / 2;
        const invY = below
            ? hotbarY + window.RSTH_IH.Hotbarheight + 10
            : hotbarY - window.RSTH_IH.Inventoryheight - 10;

        return {
            x: Math.max(0, Math.min(invX, gw - window.RSTH_IH.Inventorywidth)),
            y: Math.max(0, Math.min(invY, gh - window.RSTH_IH.Inventoryheight))
        };
    }

    // ポップアップテキスト表示
    window.RSTH_IH.updateHoverTextShared = function (self, items) {

        if (RSTH_DEBUG_LOG) console.log("[updateHoverTextShared]start");
        if (!self.isOpen?.() || !self.visible) return;

        const popup = SceneManager._scene._hoverTextSprite;
        if (!popup) return;

        const x = self.canvasToLocalX(TouchInput.x);
        const y = self.canvasToLocalY(TouchInput.y);
        const index = self.hitTest(x, y);

        if (RSTH_DEBUG_LOG) console.log("[updateHoverTextShared]items", items);
        if (index >= 0 && items[index]) {
            const item = items[index];

            // itemオブジェクト全体を渡すように変更
            if (popup._item !== item) {
                popup.setText(item);
                if (RSTH_DEBUG_LOG) console.log("[updateHoverTextShared]item ", item);
            }
            window.RSTH_IH.__popupOwner = self;
        } else if (window.RSTH_IH.__popupOwner === self) {
            popup.setText(null);
            window.RSTH_IH.__popupOwner = null;
        }
        if (RSTH_DEBUG_LOG) console.log("[updateHoverTextShared]end");
    };



    window.RSTH_IH.Sprite_PopupText = class extends Sprite {
        constructor() {
            super(new Bitmap(1, 1)); // 最初は仮サイズ
            this._item = null;
            this.visible = false;
            this.anchor.x = 0;
            this.anchor.y = 1;
            this.padding = 6;
            this.lineHeight = 24;
        }

        setText(item) {

            if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]start");
            const bmp = this.bitmap;
            bmp.clear();

            if (!item) return;

            this._item = window.RSTH_IH.getGameItem(item);
            this.visible = !!item;

            if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]item", item);
            if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]this._item", this._item);
            // 必要な情報を抽出
            const name = this._item.name || "???";
            const type = item.type;
            const effect = (this._item.effects && this._item.effects.length > 0) ?
                this.formatEffect(this._item.effects[0]) : "なし";
            const price = this._item.price ?? 0;
            const desc = this._item.description || "";

            // 表示する行
            let lines = [];
            lines = [
                name,
                "-------------------------",
                `種別：${type}`
            ]
            let blockType = "ground";
            let blockHP = 1;
            let blockSize = [1, 1];
            let storageSize = [1, 1];
            if (type === "block") {
                if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]this._item.meta", this._item.meta);
                if (this._item.meta) {
                    blockType = this._item.meta.blockType ?? "ground";
                    blockHP = this._item.meta.blockHP ?? 1;
                    blockSize = this._item.meta.size ?? [1, 1];
                }
                lines.push(`blockType ：${blockType}`, `blockHP ：${blockHP}`, `blockSize ：${blockSize}`);
                if (blockType === "chest") {
                    storageSize = this._item.meta.chestsize ?? [1, 1];
                    lines.push(`storageSize ：${storageSize}`);
                }
            } else if (type === "weapon" || type === "tool" || type === "armor") {
                if (this._item.params[0] !== 0) lines.push(`MaxHP：${this._item.params[0]}`);
                if (this._item.params[1] !== 0) lines.push(`MaxMP：${this._item.params[1]}`);
                if (this._item.params[2] !== 0) lines.push(`Atk：${this._item.params[2]}`);
                if (this._item.params[3] !== 0) lines.push(`Def：${this._item.params[3]}`);
                if (this._item.params[4] !== 0) lines.push(`MagAtk：${this._item.params[4]}`);
                if (this._item.params[5] !== 0) lines.push(`MagDef：${this._item.params[5]}`);
                if (this._item.params[6] !== 0) lines.push(`Agi：${this._item.params[6]}`);
                if (this._item.params[7] !== 0) lines.push(`Luk：${this._item.params[7]}`);
            }
            let toolpower = 1;
            if (type === "tool") {
                try {
                    toolpower = JSON.parse(this._item.meta.toolPower || 1);
                } catch (e) {
                    toolpower = 1;
                }
                if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]this.item.meta", this._item.meta);
                if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]toolpower", toolpower);
                lines.push(`ToolAtk：${toolpower}`);
            }
            lines.push(
                `効果：${effect}`,
                `価格：${price}`,
                `説明：${desc}`
            );


            // 一時設定で幅を測る
            bmp.fontSize = 18;
            bmp.textColor = "#ffffff";
            bmp.outlineColor = "#000000";
            bmp.outlineWidth = 3;

            const maxTextWidth = lines.reduce((max, line) => {
                const w = bmp.measureTextWidth(line);
                return Math.max(max, w);
            }, 0);

            // 必要なサイズを計算して再作成
            const w = maxTextWidth + this.padding * 2;
            const h = lines.length * this.lineHeight + this.padding * 2;

            this.bitmap = new Bitmap(w, h);
            const newBmp = this.bitmap;

            // 背景
            newBmp.fillRect(0, 0, w, h, "rgba(0,0,0,0.7)");

            // テキスト再描画
            newBmp.fontSize = 18;
            newBmp.textColor = "#ffffff";
            newBmp.outlineColor = "#000000";
            newBmp.outlineWidth = 3;

            // 各行描画
            for (let i = 0; i < lines.length; i++) {
                const y = this.padding + i * this.lineHeight;
                newBmp.drawText(lines[i], this.padding, y, w - this.padding * 2, this.lineHeight, "left");
            }
            if (RSTH_DEBUG_LOG) console.log("[Sprite_PopupText][setText(item)]end");
        }

        formatEffect(effect) {
            if (!effect) return "なし";
            if (effect.code === 11) {
                return `HP回復 ${effect.value2}`;
            }
            if (effect.code === Game_Action.EFFECT_RECOVER_MP) {
                return `MP回復 ${effect.value2}`;
            }
            return "効果なし";
        }

        update() {
            super.update();
            if (this.visible) {
                const offsetX = 16;
                const offsetY = 16;

                const bw = this.bitmap.width;
                const bh = this.bitmap.height;

                // ベース位置（アンカーが (0,1) のため、下に表示されるよう調整）
                let newX = TouchInput.x + offsetX;
                let newY = TouchInput.y + offsetY;

                // 右端に吸着
                if (newX + bw > Graphics.width) {
                    newX = Graphics.width - bw;
                }

                // 左端に吸着
                if (newX < 0) {
                    newX = 0;
                }

                // 下端に吸着（アンカーYが1なので、Y座標が「下端」を指す）
                if (newY > Graphics.height) {
                    newY = Graphics.height;
                }

                // 上端に吸着（アンカーYが1なので、上にはみ出す可能性は newY - bh < 0）
                if (newY - bh < 0) {
                    newY = bh;
                }

                this.x = newX;
                this.y = newY;
            }
        }



    };



    // 通常のGainItemの呼び出し
    window.RSTH_IH.__Vanilla_GainItem = function (item, amount, includeEquip) {
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



    // プレイヤーの正面タイルの座標を取得する関数
    window.RSTH_IH.getFrontTileXY = function (itemId) {
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
    window.RSTH_IH.getItemType = function (item) {
        if (!item) return "unknown";
        if (RSTH_DEBUG_LOG) console.log("[getItemType]item = ", item);
        if (RSTH_DEBUG_LOG) console.log("[getItemType]item.type = ", item.type);

        // IDに基づいて item / weapon / armor を判定
        if (window.RSTH_IH.isItemById(item)) {
            const tileId = Number(item.meta?.tileId);
            if (!isNaN(tileId) || item.type === "block") {
                if (RSTH_DEBUG_LOG) console.log("[getItemType]種別: block と判定されました", item.name, "tileId:", tileId);
                return "block";
            }
            if (RSTH_DEBUG_LOG) console.log("[getItemType]種別: item と判定されました", item.name);
            return "item";
        }

        if (window.RSTH_IH.isWeaponById(item)) {
            if (item.meta?.tool !== undefined || item.type === "tool") {
                if (RSTH_DEBUG_LOG) console.log("[getItemType]種別: tool と判定されました", item.name);
                return "tool"; // tool タグがある武器は tool 扱い
            }
            if (RSTH_DEBUG_LOG) console.log("[getItemType]種別: weapon と判定されました", item.name);
            return "weapon";
        }

        if (window.RSTH_IH.isArmorById(item)) {
            if (RSTH_DEBUG_LOG) console.log("[getItemType]種別: armor と判定されました", item.name);
            return "armor";
        }

        if (RSTH_DEBUG_LOG) console.log("[getItemType]種別: unknown と判定されました", item.name);
        return "unknown";
    };

    // 武器がツールか否か
    window.RSTH_IH.isToolWeapon = function (item) {
        return DataManager.isWeapon(item) && item.meta.tool !== undefined;
    }


    // ツールがブロックに対して有効であるか否か
    window.RSTH_IH.getEffectiveBlocks = function (item) {
        try {
            return JSON.parse(item.meta.blockEffective || "[]");
        } catch (e) {
            return [];
        }
    }

    // ウィンドウ内かどうか判定
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
        const type = window.RSTH_IH.getItemType(item);
        const maxStack = ["weapon", "armor", "tool"].includes(type) ? 1 : window.RSTH_IH.StackSize;

        // 既存スロットでスタックできるか？
        for (const slot of inv) {
            if (slot && slot.id === item.id && slot.type === type && slot.count < maxStack) {
                return true;
            }
        }
        for (const slot of hot) {
            if (slot && slot.id === item.id && slot.type === type && slot.count < maxStack) {
                return true;
            }
        }

        // 空きスロット確認（明示的に最大数までチェック）
        const maxInv = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows;
        const maxHot = window.RSTH_IH.HotbarSlotCount;

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

    // アイテムが通常アイテムかどうか判定（$dataItemsとの照合）
    window.RSTH_IH.isItemById = function (item) {
        if (RSTH_DEBUG_LOG) console.log("[isItemById]item = ", item);
        return item && item.id != null &&
            $dataItems[item.id] &&
            $dataItems[item.id].name === item.name;
    };

    // アイテムが武器かどうか判定（$dataWeaponsとの照合）
    window.RSTH_IH.isWeaponById = function (item) {
        if (RSTH_DEBUG_LOG) console.log("[isWeaponById]item = ", item);
        return item && item.id != null &&
            $dataWeapons[item.id] &&
            $dataWeapons[item.id].name === item.name;
    };

    // アイテムが防具かどうか判定（$dataArmorsとの照合）
    window.RSTH_IH.isArmorById = function (item) {
        if (RSTH_DEBUG_LOG) console.log("[isArmorById]item = ", item);
        return item && item.id != null &&
            $dataArmors[item.id] &&
            $dataArmors[item.id].name === item.name;
    };


})();