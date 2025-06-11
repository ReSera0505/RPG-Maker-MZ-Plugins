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

    // ウィンドウの共通リフレッシュ処理
    window.RSTH_IH.drawItemSlotGrid = function (self, items, cols, rows, tileSize, margin, selectedIndex = -1, isHotbar = false) {
        self.contents.clearRect(0, 0, self.contents.width, self.contents.height);

        const max = cols * rows;
        if (!Array.isArray(items)) return;

        for (let i = 0; i < max; i++) {
            const item = items[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = self.itemPadding + col * (tileSize + margin);
            const y = self.itemPadding + row * (tileSize + margin);

            const rect = self.itemRect(i);

            self.contents.paintOpacity = 128;
            self.contents.fillRect(rect.x, rect.y, rect.width, rect.height, "#8888ff");
            self.contents.paintOpacity = 255;

            if (item) {
                const iconIndex = item.iconIndex || 0;
                const bitmap = ImageManager.loadSystem("IconSet");
                const pw = 32, ph = 32;
                const sx = (iconIndex % 16) * pw;
                const sy = Math.floor(iconIndex / 16) * ph;
                self.contents.blt(bitmap, sx, sy, pw, ph, rect.x, rect.y, rect.width, rect.height);

                const count = item.count || 1;
                if (count > 1) {
                    self.contents.fontSize = 16;
                    self.contents.textColor = "#ffffff";
                    self.contents.outlineColor = "#000000";
                    self.contents.outlineWidth = 3;
                    self.contents.drawText(
                        count,
                        rect.x,
                        rect.y + rect.height - 16,
                        rect.width,
                        20,
                        "right"
                    );
                }
            }

            if (isHotbar) {
                const label = (i === 9) ? "0" : `${i + 1}`;
                self.contents.fontSize = 12;
                self.contents.textColor = "#ffffff";
                self.contents.outlineColor = "#000000";
                self.contents.outlineWidth = 4;
                self.contents.drawText(label, rect.x, rect.y - 4, 20, 20, "left");
            }

            if (i === selectedIndex) {
                self.contents.strokeRect(rect.x, rect.y, rect.width, rect.height, "#ffffff", 5);
            }
        }
    };





    // ウィンドウのsetitems共通処理
    window.RSTH_IH.setItemsSafe = function (self, items, storageKey = null) {
        if (!self.items) self.items = [];

        const changed =
            self.items.length !== items.length ||
            items.some((item, i) => {
                const current = self.items[i];
                return !current || !item || current.id !== item.id || current.count !== item.count;
            });

        if (!changed) return;

        self.items = items.map(item => item ? JSON.parse(JSON.stringify(item)) : null);

        if (storageKey === "_customChestItems") {
            const scene = SceneManager._scene;
            const chestPos = scene?._openedChestPos;
            if (chestPos) {
                const chest = window.RSTH_IH.ChestManager.getChestAt(chestPos.x, chestPos.y);
                if (chest) {
                    chest.items = self.items.map(item => item ? JSON.parse(JSON.stringify(item)) : null);
                    if (RSTH_DEBUG_LOG) console.log(`[setItemsSafe] チェスト (${chestPos.x}, ${chestPos.y}) に保存`, chest.items);
                    return; // $gameSystem に保存しない
                }
            }
        }

        // 通常保存（インベントリ・ホットバーなど）
        if (storageKey) {
            $gameSystem[storageKey] = self.items;
        }

        if (RSTH_DEBUG_LOG) console.log(`[setItemsSafe]self.items`, self.items);
    };



    // ウィンドウのprocessTouch()共通処理
    window.RSTH_IH.handleSlotTouchShared = function (self, contextType, itemList, onUseItem) {
        if (!self.visible || self.openness <= 0) return;

        const x = self.canvasToLocalX(TouchInput.x);
        const y = self.canvasToLocalY(TouchInput.y);
        const index = self.hitTest(x, y);

        // スロット選択（右クリック時はカーソル移動しない）
        if (
            index >= 0 &&
            index !== self.selectedIndex &&
            typeof self.selectSlotByIndex === "function" &&
            TouchInput._mousePressed !== 2 // 右クリック中なら無視
        ) {
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

    // チェストウィンドウのprocessTouch()処理
    window.RSTH_IH.handleSlotTouchChest = function (self, contextType, itemList) {
        if (!self.visible || self.openness <= 0) return;

        const x = self.canvasToLocalX(TouchInput.x);
        const y = self.canvasToLocalY(TouchInput.y);
        const index = self.hitTest(x, y);

        // スロット選択（右クリック時はカーソル移動しない）
        if (
            index >= 0 &&
            index !== self.selectedIndex &&
            typeof self.selectSlotByIndex === "function" &&
            TouchInput._mousePressed !== 2 // 右クリック中なら無視
        ) {
            self.selectSlotByIndex(index);
        }

        // ドラッグ開始
        if (TouchInput.isTriggered() && index >= 0 && itemList[index]) {
            window.RSTH_IH.__draggingItem = itemList[index];
            window.RSTH_IH.__draggingFrom = contextType;
            window.RSTH_IH.__draggingIndex = index;
        }
    }

    // アイテムのドラッグ＆ドロップの処理担当
    window.RSTH_IH.handleInventoryDragDrop = function (self) {
        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]0`);
        if (!TouchInput.isReleased() || !window.RSTH_IH.__draggingItem) return;

        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]1`);

        const targetX = TouchInput.x;
        const targetY = TouchInput.y;

        const draggingFrom = window.RSTH_IH.__draggingFrom;
        const draggingIndex = window.RSTH_IH.__draggingIndex;
        const draggingItem = window.RSTH_IH.__draggingItem;

        const from = draggingFrom;
        const fromIndex = draggingIndex;
        const item = draggingItem;

        const shift = Input.isPressed("shift");
        const scene = SceneManager._scene;
        const hotbar = scene._hotbarWindow;
        const inv = scene._inventoryWindow;
        const chest = scene._chestWindow;

        const invX = inv.canvasToLocalX(TouchInput.x);
        const invY = inv.canvasToLocalY(TouchInput.y);
        const invIndex = inv.hitTest(invX, invY);

        const hotbarX = hotbar.canvasToLocalX(TouchInput.x);
        const hotbarY = hotbar.canvasToLocalY(TouchInput.y);
        const hotbarIndex = hotbar.hitTest(hotbarX, hotbarY);

        const chestX = chest.canvasToLocalX(TouchInput.x);
        const chestY = chest.canvasToLocalY(TouchInput.y);
        const chestIndex = chest.hitTest(chestX, chestY);

        const isSameWindow = (from === "hotbar" && self instanceof window.RSTH_IH.Window_Hotbar) ||
            (from === "inventory" && self instanceof window.RSTH_IH.Window_Inventory) ||
            (from === "chest" && self instanceof window.RSTH_IH.Window_Chest);

        const isInventoryOpen = SceneManager._scene?._inventoryWindow?.visible;
        if (!isInventoryOpen && !isSameWindow) {
            window.RSTH_IH.resetDragging();
            return;
        }

        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]draggingFrom`, draggingFrom);
        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]draggingIndex`, draggingIndex);
        if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]draggingItem`, draggingItem);

        // ▼ インベントリ → ホットバー
        if (from === "inventory" && hotbarIndex >= 0 && isInventoryOpen) {
            const target = "hotbar";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }
        // インベントリ → チェスト
        if (from === "inventory" && chestIndex >= 0 && isInventoryOpen) {
            const target = "chest";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }

        // ▼ ホットバー → インベントリ
        if (from === "hotbar" && invIndex >= 0 && isInventoryOpen) {
            const target = "inventory";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }

        // ▼ ホットバー → チェスト
        if (from === "hotbar" && chestIndex >= 0) {
            const target = "chest";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }


        // チェスト → インベントリ
        if (from === "chest" && invIndex >= 0 && isInventoryOpen) {
            const target = "inventory";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }

        // チェスト  → ホットバー
        if (from === "chest" && hotbarIndex >= 0 && isInventoryOpen) {
            const target = "hotbar";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }

        // ▼ インベントリ → インベントリ
        if (from === "inventory" && invIndex >= 0 && isInventoryOpen) {
            const target = "inventory";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }

        // ホットバー → ホットバー
        if (from === "hotbar" && hotbarIndex >= 0) {
            const target = "hotbar";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);
        }

        // ▼ チェスト → チェスト
        if (from === "chest" && chestIndex >= 0 && isInventoryOpen) {
            const target = "chest";
            window.RSTH_IH.handleDragDropfromto(item, from, target, fromIndex);

        }

        // ▼ ウィンドウ外へのドロップ → マップ上にアイテムをドロップ
        const targetTileX = $gameMap.canvasToMapX(targetX);
        const targetTileY = $gameMap.canvasToMapY(targetY);

        const playerX = $gamePlayer.x;
        const playerY = $gamePlayer.y;
        const distance = Math.abs(targetTileX - playerX) + Math.abs(targetTileY - playerY);

        const isInWindow =
            window.RSTH_IH.isInsideWindow(scene._inventoryWindow, targetX, targetY) ||
            window.RSTH_IH.isInsideWindow(scene._hotbarWindow, targetX, targetY) ||
            window.RSTH_IH.isInsideWindow(scene._chestWindow, targetX, targetY) ||
            window.RSTH_IH.isInsideWindow(scene._workbenchWindow, targetX, targetY) ||
            window.RSTH_IH.isInsideWindow(scene._equipmentWindow, targetX, targetY);

        const isInDropRange = distance <= 6;

        if (!isInWindow && isInDropRange && item) {
            // ドロップ処理（1個か全量かはshiftで判定）
            const dropCount = shift ? (item.count || 1) : 1;
            const dropItem = Object.assign({}, item, { count: dropCount });

            // プレイヤーからドロップ位置へアイテムが飛ぶアニメーション
            const sprite = new Sprite(ImageManager.loadSystem("IconSet"));
            sprite.setFrame(item.iconIndex % 16 * 32, Math.floor(item.iconIndex / 16) * 32, 32, 32);
            sprite.x = $gamePlayer.screenX();
            sprite.y = $gamePlayer.screenY() - 24;

            SceneManager._scene.addChild(sprite);

            const targetScreenX = $gameMap.tileWidth() * (targetTileX - $gameMap.displayX());
            const targetScreenY = $gameMap.tileHeight() * (targetTileY - $gameMap.displayY());

            let frame = 0;
            const totalFrames = 20;
            const startX = sprite.x;
            const startY = sprite.y;
            const dx = targetScreenX - startX;
            const dy = targetScreenY - startY;

            sprite.update = function () {
                frame++;
                const t = frame / totalFrames;
                sprite.x = startX + dx * t;
                sprite.y = startY + dy * t - 20 * Math.sin(Math.PI * t);
                if (frame >= totalFrames) {
                    SceneManager._scene.removeChild(sprite);
                    sprite.update = null;

                    // ▼ アニメーション後にドロップとアイテム減算
                    window.RSTH_IH.DropManager.dropItemSmart(targetTileX, targetTileY, dropItem);

                    if (RSTH_DEBUG_LOG) console.log(`[handleInventoryDragDrop]targetTileX=${targetTileX},targetTileY=${targetTileY},dropItem=`, dropItem);

                    if (from === "inventory") {
                        const slot = inv.items[fromIndex];
                        if (slot) {
                            if (slot.count > dropCount) {
                                slot.count -= dropCount;
                            } else {
                                inv.items[fromIndex] = null;
                            }
                            $gameSystem._customInventoryItems = inv.items;
                            inv.refresh();
                            if (scene._workbenchWindow.visible) {
                                scene._workbenchWindow.refresh();
                            }
                        }
                    } else if (from === "hotbar") {
                        const slot = hotbar.items[fromIndex];
                        if (slot) {
                            if (slot.count > dropCount) {
                                slot.count -= dropCount;
                            } else {
                                hotbar.items[fromIndex] = null;
                            }
                            $gameSystem._customHotbarItems = hotbar.items;
                            hotbar.refresh();
                            if (scene._workbenchWindow.visible) {
                                scene._workbenchWindow.refresh();
                            }
                        }
                    } else if (from === "chest") {
                        const chestPos = scene._openedChestPos;
                        if (chestPos) {
                            const targetChest = window.RSTH_IH.ChestManager.getChestAt(chestPos.x, chestPos.y);
                            if (targetChest) {
                                const chestItems = targetChest.items;
                                const slot = chestItems[fromIndex];
                                if (slot) {
                                    if (slot.count > dropCount) {
                                        slot.count -= dropCount;
                                    } else {
                                        chestItems[fromIndex] = null;
                                    }
                                    chest.setItems(chestItems);
                                    chest.refresh();
                                }
                            }
                        }
                    }
                }
            };


            // `updateChildren` の定義がなければ定義する（1回のみでOK）
            if (!SceneManager._scene._hasDropUpdateHook) {
                SceneManager._scene._hasDropUpdateHook = true;
                const _updateChildren = SceneManager._scene.updateChildren || function () { };
                const animatedSprites = [];

                SceneManager._scene.updateChildren = function () {
                    _updateChildren.call(this);
                    // アニメーション用スプライトだけ更新
                    for (const s of animatedSprites) {
                        if (s.update) s.update();
                    }
                    // 終了したスプライトを除外
                    for (let i = animatedSprites.length - 1; i >= 0; i--) {
                        if (!animatedSprites[i].update) {
                            animatedSprites.splice(i, 1);
                        }
                    }
                };

                // 外部から登録できるようにする
                SceneManager._scene.registerDropAnimation = function (sprite) {
                    animatedSprites.push(sprite);
                };
            }

        }



        window.RSTH_IH.resetDragging();
    }








})();