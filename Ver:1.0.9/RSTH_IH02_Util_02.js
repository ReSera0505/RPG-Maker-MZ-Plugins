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

    // プレイヤーの周囲にイベントがあるかの判定
    window.RSTH_IH.tryTalkToNearbyEvent = function (targetX, targetY) {
        const playerX = $gamePlayer.x;
        const playerY = $gamePlayer.y;

        const dx = targetX - playerX;
        const dy = targetY - playerY;
        const distance = Math.abs(dx) + Math.abs(dy); // マンハッタン距離

        if (distance > 3) return false; // 距離が3マス超えてたら無視

        const events = $gameMap.eventsXy(targetX, targetY);
        if (events.length === 0) return false;

        const event = events[0];
        if (!event || !event.event()) return false;

        // プレイヤーの向きをそのイベントに向ける
        $gamePlayer.turnTowardCharacter(event);

        // 強制的にそのイベントを開始
        event.start();
    };

    // 右クリックでアイテム使用かイベントと会話か判定して実行
    TouchInput._onRightButtonDown = function (event) {
        if (!(SceneManager._scene instanceof Scene_Map)) return;

        if ($gameMessage.isBusy()) return;
        const x = Graphics.pageToCanvasX(event.pageX);
        const y = Graphics.pageToCanvasY(event.pageY);

        const scene = SceneManager._scene;
        // 以下のウィンドウ内かどうか判定
        const isInWindow =
            window.RSTH_IH.isInsideWindow(scene._inventoryWindow, x, y) ||
            window.RSTH_IH.isInsideWindow(scene._hotbarWindow, x, y) ||
            window.RSTH_IH.isInsideWindow(scene._equipmentWindow, x, y);


        if (!isInWindow && Graphics.isInsideCanvas(x, y)) {

            const tileX = $gameMap.canvasToMapX(x);
            const tileY = $gameMap.canvasToMapY(y);

            let noneevents = window.RSTH_IH.tryTalkToNearbyEvent(tileX, tileY);
            noneevents = noneevents ?? true;
            if (RSTH_DEBUG_LOG) console.log("noneevents", noneevents);

            if (!noneevents) {
                const hotbar = scene && scene._hotbarWindow;

                if (hotbar && hotbar.visible && SceneManager._scene instanceof Scene_Map) {
                    // ホットバー座標からindexを取得
                    if (!window.RSTH_IH.HobarSlotsIndex) window.RSTH_IH.HobarSlotsIndex = 0;
                    const index = window.RSTH_IH.HobarSlotsIndex;
                    const items = hotbar.items[index];
                    if (RSTH_DEBUG_LOG) console.log("右クリックでホットバー使用を試行");

                    if (items) {
                        if (items.type === "block") {

                            const distance = $gameMap.distance($gamePlayer.x, $gamePlayer.y, tileX, tileY);
                            if (distance <= 3) {

                                if (RSTH_DEBUG_LOG) console.log(`ホットバーのカーソル index ${index} のブロックアイテムを使用:`, items);
                                window.RSTH_IH.useInventoryItem(items, "hotbar", index, { x: tileX, y: tileY });
                                return;
                            } else {
                                if (RSTH_DEBUG_LOG) console.warn("設置不可な位置または距離超過_distance=", distance);
                            }

                        } else if (items.type === "item") {
                            if (RSTH_DEBUG_LOG) console.log(`ホットバーのカーソル index ${index} のアイテムを使用:`, items);
                            window.RSTH_IH.useInventoryItem(items, "hotbar", index);
                            return;
                        }
                    } else {
                        if (RSTH_DEBUG_LOG) console.log(`カーソル index ${index} にアイテムが存在しません`);
                    }


                }
            }

        }

        event.preventDefault?.();
        event.stopPropagation?.();
    };


    // ウィンドウの矩形範囲内かを直接チェックする
    window.RSTH_IH.isInsideWindow = function (win, x, y) {
        if (!win || !win.visible || !win.active) return false;
        return (
            x >= win.x &&
            y >= win.y &&
            x < win.x + win.width &&
            y < win.y + win.height
        );
    }

    // 左クリック検出
    window.RSTH_IH.onLeftButtonDown = function () {
        if (TouchInput.isTriggered()) {

            if ($gameMessage.isBusy()) return;

            const x = TouchInput.x;
            const y = TouchInput.y;
            if (RSTH_DEBUG_LOG) console.log("左クリック！ x:", x, "y:", y);

            // 画面内のクリックか判定（Graphicsクラスで）
            if (Graphics.isInsideCanvas(x, y)) {
                if (RSTH_DEBUG_LOG) console.log("キャンバス内を左クリック：", x, y);

                const scene = SceneManager._scene;

                // 以下のウィンドウ内かどうか判定
                const isInWindow =
                    window.RSTH_IH.isInsideWindow(scene._inventoryWindow, x, y) ||
                    window.RSTH_IH.isInsideWindow(scene._hotbarWindow, x, y) ||
                    window.RSTH_IH.isInsideWindow(scene._equipmentWindow, x, y);

                const hotbar = scene && scene._hotbarWindow;
                if (RSTH_DEBUG_LOG) console.log("isInWindow", isInWindow);

                if (!isInWindow && hotbar && hotbar.visible && SceneManager._scene instanceof Scene_Map) {
                    // ホットバー座標からindexを取得
                    if (!window.RSTH_IH.HobarSlotsIndex) window.RSTH_IH.HobarSlotsIndex = 0;

                    const mapX = $gameMap.canvasToMapX(TouchInput.x);
                    const mapY = $gameMap.canvasToMapY(TouchInput.y);
                    const index = window.RSTH_IH.HobarSlotsIndex;
                    const items = hotbar.items[index];
                    const distance = $gameMap.distance($gamePlayer.x, $gamePlayer.y, mapX, mapY);
                    if (distance <= 3) {
                        if (RSTH_DEBUG_LOG) console.log("左クリックでホットバー使用を試行");

                        if (items) {
                            if (items.type === "weapon" || items.type === "tool") {

                                if (RSTH_DEBUG_LOG) console.log(`ホットバーのカーソル index ${index} のアイテムを使用:`, items);
                                window.RSTH_IH.useInventoryItem(items, "hotbar", index);
                                return;
                            }

                        } else {
                            if (RSTH_DEBUG_LOG) console.log(`カーソル index ${index} にアイテムが存在しません`);
                        }
                    } else {
                        if (RSTH_DEBUG_LOG) console.log(`クリック位置が範囲外`);
                    }

                }
            }
        }
    }

    // ドラッグをリセット
    window.RSTH_IH.resetDragging = function () {
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

                //カーソルをホットバーのインデックスへ
                if (scene._hotbarWindow && window.RSTH_IH.HobarSlotsIndex != null) {
                    if (window.RSTH_IH.HobarSlotsIndex === -1) window.RSTH_IH.HobarSlotsIndex = 0;
                    scene.updateCursorForSlot(window.RSTH_IH.HobarSlotsIndex, scene._hotbarWindow);
                }


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

    // アイテムを挿入できるスロット位置（index）を返す関数
    window.RSTH_IH.findInsertSlot = function (slots, item, count = 1) {
        const type = window.RSTH_IH.getItemType(item);
        const maxStack = ["weapon", "armor", "tool"].includes(type) ? 1 : window.RSTH_IH.StackSize;


        // スタック可能なスロットを探す
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (slot && slot.id === item.id && slot.type === type && slot.count + count <= maxStack) {
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
        const type = window.RSTH_IH.getItemType(item);
        const inv = $gameSystem._customInventoryItems || [];
        const hot = $gameSystem._customHotbarItems || [];

        const existsInInv = inv.some(slot => slot && slot.id === item.id && slot.type === type);
        const existsInHot = hot.some(slot => slot && slot.id === item.id && slot.type === type);

        return existsInInv || existsInHot;
    };

    // ブロックを置けるかチェック
    window.RSTH_IH.canPlaceBlockAt = function (x, y, item) {
        if (RSTH_DEBUG_LOG) console.log(`[canPlaceBlockAt]item`, item, `item.meta`, item.meta);

        if (!item || !item.meta || !item.meta.tileOffsets1) return false;
        const placingType = item.meta.blockType;
        if (!placingType) return false;

        try {
            const tileOffsets = JSON.parse(item.meta.tileOffsets1);
            if (!Array.isArray(tileOffsets)) return false;

            for (const offset of tileOffsets) {
                const dx = Number(offset.dx || 0);
                const dy = Number(offset.dy || 0);
                const px = x + dx;
                const py = y + dy;

                if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt]offset`, offset);

                // マップ外チェック
                if (px < 0 || py < 0 || px >= $gameMap.width() || py >= $gameMap.height()) {
                    if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt] (${px},${py})がマップ外。設置不可`);
                    return false;
                }

                // 通行不可タイルチェック
                if (!$gameMap.checkPassage(px, py, 0x0f)) {
                    if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt] (${px}, ${py}) は通行不可タイル。設置不可`);
                    return false;
                }

                // イベント存在チェック
                if ($gameMap.eventsXy(px, py).length > 0) {
                    if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt] (${px}, ${py}) にイベントが存在。設置不可`);
                    return false;
                }

                // プレイヤー座標チェック
                if ($gamePlayer.x === px && $gamePlayer.y === py) {
                    if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt] (${px}, ${py}) はプレイヤーの位置。設置不可`);
                    return false;
                }

                // 既存ブロックとの blockType 互換性チェック
                const existingBlock = window.RSTH_IH.SurvivalBlockManager.get(px, py);
                if (existingBlock) {
                    const existingItem = $dataItems[existingBlock.itemId];
                    const baseType = existingItem?.meta?.blockType;
                    if (!baseType) return false;

                    const allowed = (
                        (baseType === "ground" && ["floor", "wall", "furniture", "plant"].includes(placingType)) ||
                        (baseType === "floor" && ["wall", "furniture", "plant"].includes(placingType))
                    );
                    if (!allowed) {
                        if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt] blockType incompatibility: cannot place ${placingType} on ${baseType}`);
                        return false;
                    }
                }
            }

            return true;
        } catch (e) {
            if (RSTH_DEBUG_LOG) console.warn(`[canPlaceBlockAt] JSON解析エラー`, e);
            return false;
        }
    };


    // 独自のカーソルの描画
    Scene_Map.prototype.updateCursorForSlot = function (index, windowInstance) {
        if (!this._rsthCursorSprite) return;

        const sprite = this._rsthCursorSprite;

        // メッセージ表示中なら非表示にする
        if ($gameMessage.isBusy()) {
            sprite.visible = false;
            sprite.bitmap.clear();
            return;
        }

        const rect = windowInstance.itemRect(index);
        const padding = 4; // 外側に広げる余白
        const borderWidth = 4; // 線の太さ
        const color = "#ffff44"; // 線の色

        // サイズ変更
        const w = rect.width + padding * 2;
        const h = rect.height + padding * 2;

        if (sprite.bitmap.width !== w || sprite.bitmap.height !== h) {
            sprite.bitmap = new Bitmap(w, h);
        } else {
            sprite.bitmap.clear();
        }

        const bmp = sprite.bitmap;

        // 四辺に太線を描く
        bmp.fillRect(0, 0, w, borderWidth, color); // 上
        bmp.fillRect(0, h - borderWidth, w, borderWidth, color); // 下
        bmp.fillRect(0, 0, borderWidth, h, color); // 左
        bmp.fillRect(w - borderWidth, 0, borderWidth, h, color); // 右

        // 表示位置（スロットの画面座標に補正）
        sprite.x = windowInstance.x + rect.x + windowInstance.padding;
        sprite.y = windowInstance.y + rect.y + windowInstance.padding;

        sprite.visible = true;
    };





})();