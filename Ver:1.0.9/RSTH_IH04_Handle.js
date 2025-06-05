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

            const snapshot = item ? JSON.parse(JSON.stringify(item)) : null;
            if (RSTH_DEBUG_LOG) console.log(`[drawItemSlotGrid] index=${i}, item=`, snapshot);

            const rect = self.itemRect(i);

            self.contents.paintOpacity = 128;
            self.contents.fillRect(rect.x, rect.y, rect.width, rect.height, "#8888ff");
            self.contents.paintOpacity = 255;


            if (item) {
                const bitmap = ImageManager.loadSystem("IconSet");
                const pw = 32, ph = 32;
                const sx = (item.iconIndex % 16) * pw;
                const sy = Math.floor(item.iconIndex / 16) * ph;
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

            // スロット番号の描画（ホットバー用）
            if (isHotbar) {
                const label = (i === 9) ? "0" : `${i + 1}`; // 10番目のスロットは「0」に
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
    }



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


        if (storageKey) {
            $gameSystem[storageKey] = self.items;
        }

    }


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
        const hotbar = SceneManager._scene._hotbarWindow;
        const inv = SceneManager._scene._inventoryWindow;

        const invX = inv.canvasToLocalX(TouchInput.x);
        const invY = inv.canvasToLocalY(TouchInput.y);
        const index = inv.hitTest(invX, invY);

        const nonStackableTypes = ["weapon", "armor", "tool"];

        const isSameWindow = (from === "hotbar" && self instanceof window.RSTH_IH.Window_Hotbar) ||
            (from === "inventory" && self instanceof window.RSTH_IH.Window_Inventory);
        const isInventoryOpen = SceneManager._scene?._inventoryWindow?.visible;
        if (!isInventoryOpen && !isSameWindow) {
            window.RSTH_IH.resetDragging();
            return;
        }

        // ▼ インベントリ → ホットバー
        if (from === "inventory" && isInventoryOpen) {
            const hx = TouchInput.x - hotbar.x - hotbar.padding;
            const hy = TouchInput.y - hotbar.y - hotbar.padding;
            const hotbarIndex = hotbar.hitTest(hx, hy);
            if (hotbarIndex >= 0) {
                const amount = shift ? (item.count || 1) : 1;
                const fromSlot = inv.items[fromIndex];
                const targetSlot = hotbar.items[hotbarIndex];

                let moved = 0;

                if (targetSlot &&
                    targetSlot.id === item.id &&
                    targetSlot.type === item.type &&
                    targetSlot.count < window.RSTH_IH.StackSize &&
                    !nonStackableTypes.includes(targetSlot.type)
                ) {
                    const space = window.RSTH_IH.StackSize - targetSlot.count;
                    const toAdd = Math.min(space, amount);
                    targetSlot.count += toAdd;
                    moved = toAdd;

                    if (fromSlot.count > moved) {
                        fromSlot.count -= moved;
                    } else {
                        inv.items[fromIndex] = null;
                    }

                } else if (!targetSlot) {
                    const toAdd = Math.min(window.RSTH_IH.StackSize, amount);
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
                return window.RSTH_IH.resetDragging();
            }

            // インベントリ内の移動・統合処理
            if (index >= 0 && index !== fromIndex) {
                const fromSlot = inv.items[fromIndex];
                const toSlot = inv.items[index];

                const amount = shift ? (fromSlot.count || 1) : 1;
                if (RSTH_DEBUG_LOG) console.log("amount", amount);

                if (toSlot && fromSlot &&
                    fromSlot.id === toSlot.id &&
                    fromSlot.type === toSlot.type &&
                    !nonStackableTypes.includes(fromSlot.type)) {
                    // ▼ アイテム統合処理（同種）
                    const maxStack = window.RSTH_IH.StackSize;
                    const total = toSlot.count + amount;

                    if (total <= maxStack) {
                        toSlot.count = total;
                        fromSlot.count -= amount;
                        if (fromSlot.count <= 0) inv.items[fromIndex] = null;
                    } else {
                        const actualMoved = maxStack - toSlot.count;
                        toSlot.count = maxStack;
                        fromSlot.count -= actualMoved;
                        if (fromSlot.count <= 0) inv.items[fromIndex] = null;
                    }
                } else if (!toSlot && fromSlot) {
                    // ▼ 空きスロットに移動（Shift: 全部, 非Shift: 1個）
                    if (fromSlot.count > amount) {
                        inv.items[index] = Object.assign({}, fromSlot);
                        inv.items[index].count = amount;
                        fromSlot.count -= amount;
                    } else {
                        inv.items[index] = fromSlot;
                        inv.items[fromIndex] = null;
                    }
                } else {
                    // ▼ アイテム交換（種類違い）
                    const tmp = inv.items[index];
                    inv.items[index] = inv.items[fromIndex];
                    inv.items[fromIndex] = tmp;
                }

                $gameSystem._customInventoryItems = inv.items;
                inv.refresh();
                return window.RSTH_IH.resetDragging();
            }
        }

        // ▼ ホットバー → インベントリ
        if (from === "hotbar" && index >= 0 && isInventoryOpen) {
            const slot = hotbar?.items[fromIndex];
            if (!slot) return window.RSTH_IH.resetDragging();

            const totalCount = slot.count || 1;
            const amount = shift ? totalCount : 1;
            let moved = 0;

            const existingSlot = inv.items[index];

            if (existingSlot &&
                existingSlot.id === slot.id &&
                existingSlot.type === slot.type &&
                existingSlot.count < window.RSTH_IH.StackSize &&
                !nonStackableTypes.includes(existingSlot.type)
            ) {
                const space = window.RSTH_IH.StackSize - existingSlot.count;
                const toAdd = Math.min(space, amount);
                existingSlot.count += toAdd;
                moved += toAdd;

            } else if (!existingSlot) {
                const toAdd = Math.min(window.RSTH_IH.StackSize, amount);
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
                return window.RSTH_IH.resetDragging();
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
            return window.RSTH_IH.resetDragging();
        }

        // ホットバー → ホットバー
        if (from === "hotbar") {
            const hx = TouchInput.x - hotbar.x - hotbar.padding;
            const hy = TouchInput.y - hotbar.y - hotbar.padding;
            const dropIndex = hotbar.hitTest(hx, hy);

            // 有効なドロップ位置なら
            if (dropIndex >= 0 && dropIndex !== fromIndex) {
                const fromSlot = hotbar.items[fromIndex];
                const toSlot = hotbar.items[dropIndex];

                const amount = shift ? (fromSlot.count || 1) : 1;
                if (RSTH_DEBUG_LOG) console.log("amount", amount);

                if (toSlot && fromSlot &&
                    fromSlot.id === toSlot.id &&
                    fromSlot.type === toSlot.type &&
                    !nonStackableTypes.includes(fromSlot.type)) {
                    // ▼ アイテム統合処理（同種）
                    const maxStack = window.RSTH_IH.StackSize;
                    const total = toSlot.count + amount;

                    if (total <= maxStack) {
                        toSlot.count = total;
                        fromSlot.count -= amount;
                        if (fromSlot.count <= 0) hotbar.items[fromIndex] = null;
                    } else {
                        const actualMoved = maxStack - toSlot.count;
                        toSlot.count = maxStack;
                        fromSlot.count -= actualMoved;
                        if (fromSlot.count <= 0) hotbar.items[fromIndex] = null;
                    }
                } else if (!toSlot && fromSlot) {
                    // ▼ 空きスロットに移動（Shift: 全部, 非Shift: 1個）
                    if (fromSlot.count > amount) {
                        hotbar.items[dropIndex] = Object.assign({}, fromSlot);
                        hotbar.items[dropIndex].count = amount;
                        fromSlot.count -= amount;
                    } else {
                        hotbar.items[dropIndex] = fromSlot;
                        hotbar.items[fromIndex] = null;
                    }
                } else {
                    // ▼ アイテム交換（種類違い）
                    const tmp = hotbar.items[dropIndex];
                    hotbar.items[dropIndex] = hotbar.items[fromIndex];
                    hotbar.items[fromIndex] = tmp;
                }

                $gameSystem._customHotbarItems = hotbar.items;
                hotbar.refresh();
                return window.RSTH_IH.resetDragging();
            }
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

                    if (from === "inventory") {
                        if (inv.items[fromIndex].count > dropCount) {
                            inv.items[fromIndex].count -= dropCount;
                        } else {
                            inv.items[fromIndex] = null;
                        }
                        $gameSystem._customInventoryItems = inv.items;
                        inv.refresh();
                    } else if (from === "hotbar") {
                        if (hotbar.items[fromIndex].count > dropCount) {
                            hotbar.items[fromIndex].count -= dropCount;
                        } else {
                            hotbar.items[fromIndex] = null;
                        }
                        $gameSystem._customHotbarItems = hotbar.items;
                        hotbar.refresh();
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