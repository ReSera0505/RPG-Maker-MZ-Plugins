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
    // ドロップアイテム関連===============================================================================================
    //=============================================================================================================

    window.RSTH_IH.DroppedItem = class {
        constructor(x, y, itemData) {
            if (RSTH_DEBUG_LOG) console.log(`[window.RSTH_IH.DroppedItem] start`);
            this.x = x;
            this.y = y;
            this.item = itemData;
            this.count = (typeof count === "number" && count > 0) ? count : 1;  // ← 明示的にスタック数を管理
            this.type = window.RSTH_IH.getItemType(itemData); // ← 追加：typeを保持
            this.sprite = null;
            this._collected = false;
            this._retryCooldown = 0; // 追加：再試行までのクールダウン

            if (RSTH_DEBUG_LOG) console.log(`[window.RSTH_IH.DroppedItem] itemData`, itemData);
            if (RSTH_DEBUG_LOG) console.log(`[window.RSTH_IH.DroppedItem] end`);
        }
    }

    // アイテムドロップ（落ちてるアイテム）管理クラス
    window.RSTH_IH.DropManager = {
        _drops: [],

        dropItem(x, y, itemData) {
            const drop = new window.RSTH_IH.DroppedItem(x, y, itemData);
            drop._collected = false;
            this._drops.push(drop);
            this.createSprite(drop);
        }
        ,

        // 地面に落ちてるアイテムをスプライトで表示
        createSprite(drop) {
            if (!drop || !drop.item || drop.item.iconIndex == null) {
                if (RSTH_DEBUG_LOG) console.warn(`[createSprite] Invalid drop or item:`, drop);
                return;
            }

            if (RSTH_DEBUG_LOG) console.log(`[createSprite] for drop (${drop.x}, ${drop.y})`);

            const sprite = new Sprite();
            sprite.bitmap = ImageManager.loadSystem("IconSet");

            // アイコン設定
            const iconIndex = drop.item.iconIndex;
            const sx = (iconIndex % 16) * 32;
            const sy = Math.floor(iconIndex / 16) * 32;
            sprite.setFrame(sx, sy, 32, 32);
            sprite.z = 6;
            sprite.rotation = -Math.PI / 12;

            // ランダムオフセット計算
            const xpix = 10;
            const offset = () => Math.floor(Math.random() * (xpix * 2 + 1)) - xpix;
            drop._randomOffsetX = offset();
            drop._randomOffsetY = offset();

            // 初期座標設定
            const updatePosition = () => {
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();
                const ox = $gameMap.displayX() * tw;
                const oy = $gameMap.displayY() * th;
                sprite.x = drop.x * tw - ox + 8 + drop._randomOffsetX;
                sprite.y = drop.y * th - oy + 8 + drop._randomOffsetY;
            };
            updatePosition();

            // カウント表示（2個以上のみ）
            const count = drop.item.count || 1;
            if (count > 1) {
                const text = new Sprite(new Bitmap(64, 32));
                text.bitmap.fontSize = 18;
                text.bitmap.textColor = "#ffffff";
                text.bitmap.outlineColor = "#000000";
                text.bitmap.outlineWidth = 4;
                text.y += 12;
                text.bitmap.drawText("x" + count, 0, 0, 64, 32, "center");
                sprite.addChild(text);
                sprite._countText = text;
                sprite._countText._lastDrawn = count;
            }

            // 更新処理
            sprite.update = function () {
                // プレイヤーとの距離を更新
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();
                const ox = $gameMap.displayX() * tw;
                const oy = $gameMap.displayY() * th;

                const dropScreenX = drop.x * tw - ox + 8 + drop._randomOffsetX;
                const dropScreenY = drop.y * th - oy + 8 + drop._randomOffsetY;

                const playerScreenX = $gamePlayer.screenX();
                const playerScreenY = $gamePlayer.screenY() - 24; // 少し上めに吸い込まれる演出

                // プレイヤーと距離が近ければ吸い込まれる（1マス以内）
                const dx = drop.x - $gamePlayer.x;
                const dy = drop.y - $gamePlayer.y;
                const dist = Math.abs(dx) + Math.abs(dy);

                if (!drop._collected && dist <= window.RSTH_IH.PickUpRange) {
                    // 吸い込み演出フラグをON（1度だけ）
                    drop._readyToCollect = true;
                }

                // 吸い込み演出
                if (drop._readyToCollect && !drop._collected) {
                    const speed = 0.3;
                    this.x += (playerScreenX - this.x) * speed;
                    this.y += (playerScreenY - this.y) * speed;
                } else {
                    this.x = dropScreenX;
                    this.y = dropScreenY;
                }

                // カウント更新処理（従来通り）
                const newCount = drop.item.count || 1;
                if (this._countText) {
                    if (newCount <= 1) {
                        this._countText.visible = false;
                    } else {
                        if (this._countText._lastDrawn !== newCount) {
                            this._countText.bitmap.clear();
                            this._countText.bitmap.drawText("x" + newCount, 0, 0, 64, 32, "center");
                            this._countText._lastDrawn = newCount;
                        }
                        this._countText.visible = true;
                    }
                }
            };


            SceneManager._scene._spriteset._tilemap.addChild(sprite);
            drop.sprite = sprite;
        }


        ,

        findValidDropPosition(x, y, item) {

            const mapWidth = $gameMap.width();
            const mapHeight = $gameMap.height();
            const offsets = [
                [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
                [-1, -1], [-1, 1], [1, -1], [1, 1]
            ];

            for (const [dx, dy] of offsets) {
                const tx = x + dx;
                const ty = y + dy;

                // 範囲外チェック
                if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) continue;

                // プレイヤー位置と一致しないか
                if ($gamePlayer.x === tx && $gamePlayer.y === ty) continue;

                // イベントがないか
                if ($gameMap.eventsXy(tx, ty).length > 0) continue;

                // 通行可能か（ツクールエディタの設定に基づく）
                if (!$gameMap.checkPassage(tx, ty, 0x0f)) continue;

                // ブロックがないか（wall, furniture 以外のみ許可）
                const block = window.RSTH_IH?.SurvivalBlockManager?.getBlockAt?.(tx, ty);
                if (block?.blockType === "wall" ||
                    block?.blockType === "furniture" ||
                    block?.blockType === "plant"
                ) continue;

                // 他のドロップアイテムがないか
                // 同じ種類のドロップがある場合はスタック可能 → その座標にドロップしてスタックさせる
                const existing = this._drops.find(d =>
                    !d._collected &&
                    d.x === tx &&
                    d.y === ty &&
                    canStack(d, { item, type: window.RSTH_IH.getItemType(item) })
                );

                if (existing) {
                    return { x: tx, y: ty };
                }

                // 異なるドロップがあるなら避ける
                if (this.isItemDroppedAt(tx, ty)) continue;


                return { x: tx, y: ty };
            }

            return null; // 条件を満たす場所が見つからなかった
        }
        ,

        dropItemSmart(x, y, item) {
            const itemCount = item.count || 1;
            const MAX_STACK = 999;
            //const MAX_STACK = window.RSTH_IH.StackSize;

            // 同じマスにある同一アイテムを検索
            const existing = this._drops.find(d =>
                !d._collected &&
                d.x === x &&
                d.y === y &&
                d.item?.id === item.id &&
                window.RSTH_IH.getItemType(d.item) === window.RSTH_IH.getItemType(item)
            );

            if (existing) {
                const currentCount = existing.item.count || 1;
                const total = currentCount + itemCount;

                if (total <= MAX_STACK) {
                    // スタック可能範囲内 → 合算
                    existing.item.count = total;
                } else {
                    // 上限超過 → スタック限界まで加算し、残りは再配置
                    const overflow = total - MAX_STACK;
                    existing.item.count = MAX_STACK;

                    // 残り個数を再帰的にドロップ
                    const remainderItem = Object.assign({}, item, { count: overflow });
                    const pos = this.findValidDropPosition(x, y, remainderItem);
                    if (pos && (pos.x !== x || pos.y !== y)) {
                        this.dropItemSmart(pos.x, pos.y, remainderItem);
                    } else {
                        this.dropItem(x, y, remainderItem);
                    }
                }

                // スタック数のスプライト更新
                if (existing.sprite) {
                    if (!existing.sprite._countText) {
                        const text = new Sprite(new Bitmap(64, 32));
                        text.bitmap.fontSize = 18;
                        text.bitmap.textColor = "#ffffff";
                        text.bitmap.outlineColor = "#000000";
                        text.bitmap.outlineWidth = 4;
                        text.bitmap.drawText("x" + existing.item.count, 0, 0, 64, 32, "center");
                        text.y += 12;
                        existing.sprite.addChild(text);
                        existing.sprite._countText = text;
                    } else {
                        existing.sprite._countText.bitmap.clear();
                        existing.sprite._countText.bitmap.drawText("x" + existing.item.count, 0, 0, 64, 32, "center");
                    }
                }

                if (RSTH_DEBUG_LOG) console.log(`[dropItemSmart] スタック成功: (${x}, ${y}) → count=${existing.item.count}`);
                return;
            }

            // 新しいitemオブジェクトを作成（元を汚染しない）
            const newItem = Object.assign({}, item, { count: itemCount });

            // 他に重なりチェック →別マスへ移動（再帰でスタック確認を継続）
            const pos = this.findValidDropPosition(x, y, newItem);
            if (pos && (pos.x !== x || pos.y !== y)) {
                this.dropItemSmart(pos.x, pos.y, newItem);  // 再帰でスタック確認
            } else {
                this.dropItem(x, y, newItem);  // 最終的にスタックもできず空きもなしならそのままドロップ
            }
        }




        ,

        isItemDroppedAt(x, y) {
            if (!Array.isArray(this._drops)) return false;

            if (RSTH_DEBUG_LOG) console.log(`[isItemDroppedAt] this._drops`, this._drops);
            return this._drops.some(item => item && item.x === x && item.y === y);
        }
        ,



        update() {
            const px = $gamePlayer.x;
            const py = $gamePlayer.y;

            for (let i = this._drops.length - 1; i >= 0; i--) {
                const drop = this._drops[i];

                if (!drop) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]drop is null at index ${i}`);
                    continue;
                }

                if (!drop.item) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSpriteupdate()]drop.item is null at (${drop.x}, ${drop.y})`);
                    continue;
                }

                if (drop._collected) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSpriteupdate()]skip: already collected (${drop.x},${drop.y})`);
                    continue;
                }

                const dx = drop.x - px;
                const dy = drop.y - py;
                const dist = Math.abs(dx) + Math.abs(dy);

                if (drop._collected || drop._retryCooldown > 0) {
                    drop._retryCooldown--;
                    continue;
                }


                if (!drop._collected && dist <= window.RSTH_IH.PickUpRange) {
                    // 吸い込み演出を許可
                    drop._readyToCollect = true;
                }

                if (drop._readyToCollect && !drop._collected && drop._retryCooldown <= 0) {
                    const sprite = drop.sprite;
                    if (!sprite) continue;

                    const dx = sprite.x - $gamePlayer.screenX();
                    const dy = sprite.y - ($gamePlayer.screenY() - 24);
                    const distPx = Math.hypot(dx, dy);

                    if (distPx > window.RSTH_IH.PickUpRange + 5) {
                        // まだ吸い込みが完了してない → 回収しない
                        continue;
                    }

                    if (RSTH_DEBUG_LOG) console.log(`[DropManager.update] 回収開始判定: (${drop.x},${drop.y})`);

                    const remaining = window.RSTH_IH.tryGainItemToInventoryAndHotbar(drop.item, drop.item.count || 1);

                    if (RSTH_DEBUG_LOG) console.log(`[DropManager.update] gainItem remaining=${remaining}`);

                    if (remaining <= 0) {
                        drop._collected = true;
                        if (RSTH_DEBUG_LOG) console.log(`[DropManager.update] _collected = true (${drop.x}, ${drop.y})`);
                        this.remove(drop);
                        if (RSTH_DEBUG_LOG) console.log(`[DropManager.update] remove() 実行 (${drop.x}, ${drop.y})`);
                    } else {
                        drop.item.count = remaining;
                        drop._retryCooldown = 60;
                        drop._readyToCollect = false;
                    }
                }


            }
        }
        ,

        remove(drop) {
            if (!drop) return;

            if (drop.sprite) {
                const sprite = drop.sprite;
                drop.sprite = null;

                // 親ノードが存在するか確認してから削除
                if (sprite.parent) {
                    sprite.parent.removeChild(sprite);
                    if (RSTH_DEBUG_LOG) console.log(`[remove] sprite removed via parent`);
                } else if (SceneManager._scene && SceneManager._scene._spriteset) {
                    // 念のため spriteset からも削除
                    SceneManager._scene._spriteset.removeChild(sprite);
                    if (RSTH_DEBUG_LOG) console.log(`[remove] sprite removed from spriteset fallback`);
                }
            }

            const index = this._drops.indexOf(drop);
            if (index >= 0) {
                this._drops.splice(index, 1);
                if (RSTH_DEBUG_LOG) console.log(`[remove] drop removed from _drops[]`);
            }
        }




    };

    function canStack(drop1, drop2) {
        return drop1.item?.id === drop2.item?.id && drop1.type === drop2.type;
    }


    window.RSTH_IH.tryGainItemToInventoryAndHotbar = function (item, amount = 1) {
        if (RSTH_DEBUG_LOG) console.log(`[tryGainItemToInventoryAndHotbar]start`);
        const inv = $gameSystem._customInventoryItems ||= Array(window.RSTH_IH.InventoryCols * window.RSTH_IH.InventoryRows).fill(null);
        const hot = $gameSystem._customHotbarItems ||= Array(window.RSTH_IH.HotbarSlotCount).fill(null);

        let remaining = window.RSTH_IH.gainItemToInventory(item, amount);
        const addedToInventory = amount - remaining;

        remaining = window.RSTH_IH.gainItemToHotbar(item, remaining);

        const addedToHotbar = amount - addedToInventory - remaining;

        if (SceneManager._scene?.updateInventoryAndHotbar) {
            SceneManager._scene.updateInventoryAndHotbar();
        }

        if (SceneManager._scene?._workbenchWindow.visible) {
            SceneManager._scene._workbenchWindow.refresh();
        }
        if (SceneManager._scene?._hotbarWindow) {
            SceneManager._scene._hotbarWindow.setItems($gameSystem._customHotbarItems);
            SceneManager._scene._hotbarWindow.refresh();
        }

        return remaining; // ← この関数だけが残数を返す
    };


})();