/*:
 * @target MZ
 * @plugindesc RSTH_IH: サバイバルゲームシステムプラグイン
 * @author ReSera_りせら
 *
 * ▼ ライセンス
 * このプラグインは MITライセンス の下で公開されています。
 */

(() => {

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    //const RSTH_DEBUG_LOG = true;
    const RSTH_DEBUG_LOG = false;


    //=============================================================================================================
    // マウスポインタ関連===============================================================================================
    //=============================================================================================================
    const POINTER_IMAGE_NAME = "MousePoints";
    const POINTER_SPEED = 1.0; // 値が大きいほど高速（即時なら1.0）

    const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function () {
        _Scene_Map_createDisplayObjects.call(this);

        this.createMousePointerSprite();

        // ゴースト表示用
        this._rsthGhostSprite = new Sprite();
        this.addChild(this._rsthGhostSprite);

        document.body.style.cursor = 'none'; // マウスカーソル非表示
    };

    Scene_Map.prototype.createMousePointerSprite = function () {
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.z = 999;
        sprite._mode = null;
        this._mousePointerSprite = sprite;
        this.addChild(this._mousePointerSprite);
    };

    const _Scene_Map_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function () {
        _Scene_Map_terminate.call(this);
        document.body.style.cursor = 'auto'; // マウスカーソル再表示
    };

    Scene_Map.prototype.convertMapToCanvasX = function (mapX) {
        return (mapX - $gameMap.displayX()) * $gameMap.tileWidth();
    };

    Scene_Map.prototype.convertMapToCanvasY = function (mapY) {
        return (mapY - $gameMap.displayY()) * $gameMap.tileHeight();
    };




    Scene_Map.prototype.updateMousePointerSprite = function () {
        const sprite = this._mousePointerSprite;
        if (!sprite) return;

        const targetX = TouchInput.x;
        const targetY = TouchInput.y;

        sprite.x += (targetX - sprite.x) * POINTER_SPEED;
        sprite.y += (targetY - sprite.y) * POINTER_SPEED;

        sprite.visible =
            TouchInput.x >= 0 && TouchInput.x < Graphics.boxWidth &&
            TouchInput.y >= 0 && TouchInput.y < Graphics.boxHeight;

        const scene = SceneManager._scene;
        const index = window.RSTH_IH.HobarSlotsIndex;
        const shift = Input.isPressed("shift");
        const slot = $gameSystem._customHotbarItems?.[index];

        // ▼ 1. ドラッグ中のアイテムがあるか？
        if (RSTH_DEBUG_LOG) console.log("window.RSTH_IH.__draggingItem", window.RSTH_IH.__draggingItem);

        const draggingItem = window.RSTH_IH.__draggingItem;
        if (draggingItem?.iconIndex > 0) {
            const draggingAmount = shift ? (draggingItem.count || 1) : 1;
            const iconIndex = draggingItem.iconIndex;
            if (sprite._mode !== `drag${iconIndex}_${draggingAmount}`) {
                const iconBitmap = this.createIconBitmap(iconIndex);
                const w = iconBitmap.width;
                const h = iconBitmap.height;

                const finalBitmap = new Bitmap(w, h);
                finalBitmap.blt(iconBitmap, 0, 0, w, h, 0, 0);

                if (draggingAmount > 1) {
                    finalBitmap.fontSize = 14;
                    finalBitmap.textColor = "#ffffff";
                    finalBitmap.outlineColor = "#000000";
                    finalBitmap.outlineWidth = 3;
                    finalBitmap.drawText(`${draggingAmount}`, 0, h - 20, w - 4, 20, "right");
                }

                sprite.bitmap = finalBitmap;
                sprite._mode = `drag${iconIndex}_${draggingAmount}`;
                sprite.visible = true;
            }
            return;
        }

        // ▼ 2. ウィンドウ内なら通常カーソル画像（tile 0）
        const isInWindow =
            window.RSTH_IH.isInsideWindow(scene._inventoryWindow, targetX, targetY) ||
            window.RSTH_IH.isInsideWindow(scene._hotbarWindow, targetX, targetY) ||
            window.RSTH_IH.isInsideWindow(scene._equipmentWindow, targetX, targetY);

        if (isInWindow) {
            if (sprite._mode !== "default") {
                sprite.bitmap = this.createPointerBitmap(0);
                sprite._mode = "default";
                sprite.visible = true;
                if (this._rsthGhostSprite) {
                    this._rsthGhostSprite.visible = false;
                }
            }
            return;
        }

        // ▼ 3. マウス下のマップ座標からイベントを検索
        const mx = $gameMap.canvasToMapX(targetX);
        const my = $gameMap.canvasToMapY(targetY);

        const distance = $gameMap.distance($gamePlayer.x, $gamePlayer.y, mx, my);

        const events = $gameMap.eventsXy(mx, my);
        const nearEvent = events.find(e =>
            e instanceof Game_Event &&
            e.isNormalPriority() &&
            $gameMap.distance($gamePlayer.x, $gamePlayer.y, e.x, e.y) <= 3
        );

        if (nearEvent) {
            if (sprite._mode !== "talk") {
                sprite.bitmap = this.createPointerBitmap(1);
                sprite._mode = "talk";
                sprite.visible = true;
            }
            // ゴースト描画をキャンセルするため return を追加
            if (this._rsthGhostSprite) {
                this._rsthGhostSprite.visible = false;
            }
            return;
        }
        // ▼ 4. ブロック設置可能なアイテムを選択中ならゴースト表示
        if (distance <= 3 && slot && slot.type === "block" && Array.isArray(slot.tileOffsets1)) {
            const tileset = slot.tileset || "Inside_C";
            const bitmap = ImageManager.loadTileset(tileset);
            const offsets = slot.tileOffsets1;

            if (RSTH_DEBUG_LOG) console.log("tileset", tileset, `slot`, slot);

            bitmap.addLoadListener(() => {
                const ghost = this._rsthGhostSprite;

                // tilesetConfigsRawの解析と安全な処理
                let tilesetConfigs = [];

                if (Array.isArray(window.RSTH_IH.tilesetConfigsRaw)) {
                    tilesetConfigs = window.RSTH_IH.tilesetConfigsRaw.map(json => {
                        try {
                            return JSON.parse(json);
                        } catch (e) {
                            if (RSTH_DEBUG_LOG) console.warn("JSON parse error in tilesetConfigsRaw:", json);
                            return null;
                        }
                    }).filter(cfg => cfg);
                } else if (typeof window.RSTH_IH.tilesetConfigsRaw === "string") {
                    try {
                        const parsed = JSON.parse(window.RSTH_IH.tilesetConfigsRaw);
                        if (Array.isArray(parsed)) {
                            tilesetConfigs = parsed.map(json => {
                                try {
                                    return JSON.parse(json);
                                } catch (e) {
                                    if (RSTH_DEBUG_LOG) console.warn("Nested JSON parse error:", json);
                                    return null;
                                }
                            }).filter(cfg => cfg);
                        }
                    } catch (e) {
                        if (RSTH_DEBUG_LOG) console.warn("tilesetConfigsRaw is not a valid JSON string array:", e);
                    }
                }

                const set = tilesetConfigs.find(cfg => cfg?.name === tileset);
                const tw = Number(set?.tileSize) || 48;
                const th = Number(set?.tileSize) || 48;
                const cols = Number(set?.cols) || 8;
                if (RSTH_DEBUG_LOG) console.warn(`set${set},tw${tw},th${th},cols${cols}`);

                // 事前に最大幅・高さを tileOffsets1 から計算
                const maxDx = Math.max(...offsets.map(o => o.dx));
                const maxDy = Math.max(...offsets.map(o => o.dy));
                const width = (maxDx + 1) * tw;
                const height = (maxDy + 1) * th;

                // ghost用ビットマップを新規生成
                ghost.bitmap = new Bitmap(width, height);
                ghost.bitmap.clear();

                // 各タイルを描画
                for (const offset of offsets) {
                    const rawTileId = Number(offset.tileId);
                    const tileId = isNaN(rawTileId) ? 0 : rawTileId - 1;
                    const dx = offset.dx ?? 0;
                    const dy = offset.dy ?? 0;

                    const sx = (tileId % cols) * tw;
                    const sy = Math.floor(tileId / cols) * th;

                    if (RSTH_DEBUG_LOG) console.log("offset", offset, "tileId", tileId);
                    ghost.bitmap.blt(bitmap, sx, sy, tw, th, dx * tw, dy * th);
                }

                // ゴーストスプライトの位置設定
                ghost.x = scene.convertMapToCanvasX($gameMap.canvasToMapX(targetX));
                ghost.y = scene.convertMapToCanvasY($gameMap.canvasToMapY(targetY));
                ghost.opacity = 200;
                ghost.visible = true;

                if (RSTH_DEBUG_LOG) console.log(ghost.bitmap.width, ghost.bitmap.height, offsets);
            });

            //return;
        } else if (this._rsthGhostSprite) {
            this._rsthGhostSprite.visible = false;

        }


        // ▼ 5. 通常時はホットバーアイコン
        const iconIndex = slot?.iconIndex ?? 0;
        const itemCount = slot?.count ?? 0;

        if (slot?.type === "tool" && distance <= 3 && iconIndex > 0) {
            this.setSpriteToItemIcon(sprite, iconIndex, itemCount);
        } else if (slot?.type === "tool" && distance > 3) {
            sprite.bitmap = this.createPointerBitmap(0);
            sprite._mode = "default";
            sprite.visible = true;
        } else if (iconIndex > 0) {
            this.setSpriteToItemIcon(sprite, iconIndex, itemCount);
        } else {
            sprite.bitmap = this.createPointerBitmap(0);
            sprite._mode = "default";
            sprite.visible = true;
        }
    };

    Scene_Map.prototype.setSpriteToItemIcon = function (sprite, iconIndex, itemCount) {
        const modeKey = `icon${iconIndex}_${itemCount}`;
        if (sprite._mode !== modeKey) {
            const iconBitmap = this.createIconBitmap(iconIndex);
            const w = iconBitmap.width;
            const h = iconBitmap.height;

            const finalBitmap = new Bitmap(w, h);
            finalBitmap.blt(iconBitmap, 0, 0, w, h, 0, 0);

            if (itemCount > 1) {
                finalBitmap.fontSize = 14;
                finalBitmap.textColor = "#ffffff";
                finalBitmap.outlineColor = "#000000";
                finalBitmap.outlineWidth = 3;
                finalBitmap.drawText(`${itemCount}`, 0, h - 20, w, 20, "right");
            }

            sprite.bitmap = finalBitmap;
            sprite._mode = modeKey;
            sprite.visible = true;
        }
    }


    Scene_Map.prototype.createPointerBitmap = function (tileIndex) {
        const tw = 48, th = 48;
        const bitmap = new Bitmap(tw, th);
        const source = ImageManager.loadSystem(POINTER_IMAGE_NAME);
        const sx = tileIndex * tw;
        const sy = 0;

        if (source.width > 0) {
            bitmap.blt(source, sx, sy, tw, th, 0, 0);
        } else {
            source.addLoadListener(() => {
                bitmap.blt(source, sx, sy, tw, th, 0, 0);
            });
        }

        return bitmap;
    };

    Scene_Map.prototype.createIconBitmap = function (iconIndex) {
        const pw = 32, ph = 32;
        const sx = (iconIndex % 16) * pw;
        const sy = Math.floor(iconIndex / 16) * ph;
        const bitmap = new Bitmap(pw, ph);

        const iconSet = ImageManager.loadSystem("IconSet");
        if (iconSet.width > 0) {
            bitmap.blt(iconSet, sx, sy, pw, ph, 0, 0);
        } else {
            iconSet.addLoadListener(() => {
                bitmap.blt(iconSet, sx, sy, pw, ph, 0, 0);
            });
        }

        return bitmap;
    };

    //=============================================================================================================
    // ウィンドウ生成処理等===============================================================================================
    //=============================================================================================================
    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function () {
        _Scene_Map_createAllWindows.call(this);

        const hotbarPos = window.RSTH_IH.calculateHotbarPosition();
        const invPos = window.RSTH_IH.calculateInventoryPosition(hotbarPos.x, hotbarPos.y);

        // ホットバー
        if (typeof window.RSTH_IH.Window_Hotbar !== "undefined" && !this._hotbarWindow) {
            const rect = new Rectangle(hotbarPos.x, hotbarPos.y, window.RSTH_IH.Hotbarwidth, window.RSTH_IH.Hotbarheight);
            this._hotbarWindow = new window.RSTH_IH.Window_Hotbar(rect);
            this.addWindow(this._hotbarWindow);
            this._hotbarWindow.activate();
        }

        // インベントリ
        if (typeof window.RSTH_IH.Window_Inventory !== "undefined" && !this._inventoryWindow) {
            const rect = new Rectangle(invPos.x, invPos.y, window.RSTH_IH.Inventorywidth, window.RSTH_IH.Inventoryheight);
            this._inventoryWindow = new window.RSTH_IH.Window_Inventory(rect);
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



        this._hoverTextSprite = new window.RSTH_IH.Sprite_PopupText();
        this.addChild(this._hoverTextSprite);

        // 初回アイテム更新
        this.updateInventoryAndHotbar();

        this.RSTH_IH_createEquipmentWindow();
        this._windowLayer.removeChild(this._equipmentWindow);
        this._windowLayer.addChildAt(this._equipmentWindow, 0);

        this._rsthCursorSprite = new Sprite(new Bitmap(64, 64)); // サイズは後で動的に変更してOK
        this._rsthCursorSprite.z = 9999;
        this._rsthCursorSprite.visible = false;
        this.addChild(this._rsthCursorSprite);

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

    Scene_Map.prototype.RSTH_IH_createEquipmentWindow = function () {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        const w = window.RSTH_IH.EQUIP_SLOT_SIZE + window.RSTH_IH.Eqslotmargin * 3;
        const h = (window.RSTH_IH.EQUIP_SLOT_SIZE + window.RSTH_IH.Eqslotmargin) * window.RSTH_IH.EQUIP_INDICES.length + window.RSTH_IH.Eqslotmargin * 2;

        let x = 0;
        let y = 0;

        switch (window.RSTH_IH.EQUIP_POSITION) {
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

        this._equipmentWindow = new window.RSTH_IH.Window_EquipmentSlots(new Rectangle(x, y, w, h));
        this.addWindow(this._equipmentWindow);

        this._equipmentWindow.hide();
        this._equipmentWindow.deactivate();
    };

    //=============================================================================================================
    // ブロック情報関連===============================================================================================
    //=============================================================================================================
    window.RSTH_IH.parseDropItems = function (tag) {
        if (!tag) return [];
        return tag.split(";").map(entry => {
            const m = /itemId:(\d+),amount:(\d+)/.exec(entry);
            if (m) return { itemId: Number(m[1]), amount: Number(m[2]) };
            return null;
        }).filter(Boolean);
    }

    // 全アイテムのメモ欄を解析し、blockMetaList に保存
    Game_System.prototype.rsthLoadBlockDataFromDatabase = function () {
        if (!this._blockMetaList) this._blockMetaList = [];


        for (const item of $dataItems) {
            if (!item || !item.meta["block"]) continue;

            if (RSTH_DEBUG_LOG) console.log(`[rsthLoadBlockDataFromDatabase] item`, item.id, item.meta);
            const meta = item.meta;

            // tileOffsets1
            let tileOffsets1 = [];
            try {
                tileOffsets1 = JSON.parse(meta.tileOffsets1 || "[]");
            } catch (e) {
                if (RSTH_DEBUG_LOG) console.error("[rsthLoadBlockDataFromDatabase] tileOffsets1 JSON parse error:", e, meta.tileOffsets1);
            }

            // tileOffsets2
            let tileOffsets2 = [];
            try {
                tileOffsets2 = JSON.parse(meta.tileOffsets2 || "[]");
            } catch (e) {
                if (RSTH_DEBUG_LOG) console.error("[rsthLoadBlockDataFromDatabase] tileOffsets2 JSON parse error:", e, meta.tileOffsets2);
            }

            const data = {
                itemId: item.id,
                name: meta.blockName || item.name,
                tileId: Number(meta.tileId || 0),
                size: JSON.parse(meta.size || "[1,1]"),
                tileset: meta.tileset || "Inside_C",
                growthTime: Number(meta.growthTime || 0),
                tileOffsets1: tileOffsets1,
                tileOffsets2: tileOffsets2,
                dropItems1: window.RSTH_IH.parseDropItems(meta.dropItems1),
                dropItems2: window.RSTH_IH.parseDropItems(meta.dropItems2),
                meta: meta // 全メタを保存（後でブロックへコピー用）
            };

            this._blockMetaList.push(data);

            if (RSTH_DEBUG_LOG) console.log(`[rsthLoadBlockDataFromDatabase] this._blockMetaList`, this._blockMetaList);
        }
    };


    Game_System.prototype.rsthgetBlockMetaByItemId = function (itemId) {
        if (!Array.isArray(this._blockMetaList)) return null;
        return this._blockMetaList.find(b => b.itemId === itemId);
    };

    // ブロックが通行可能、不可能か判定する
    const _Game_Map_isPassable = Game_Map.prototype.isPassable;
    Game_Map.prototype.isPassable = function (x, y, d) {
        const block = window.RSTH_IH.SurvivalBlockManager.get(x, y);
        if (block) {
            if (block.passable === undefined) {
                if (RSTH_DEBUG_LOG) console.warn("[isPassable] passable が undefined のブロックを検出:", block);
            }

            if (RSTH_DEBUG_LOG) console.warn(`[isPassable]block`, block);
            return block.passable === true;
        }
        return _Game_Map_isPassable.call(this, x, y, d);
    };







})();
