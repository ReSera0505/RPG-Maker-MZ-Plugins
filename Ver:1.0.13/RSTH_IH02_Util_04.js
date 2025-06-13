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

    // ホットバーで現在選択されているツールを取得
    window.RSTH_IH.getCurrentTool = function () {
        const scene = SceneManager._scene;
        const hotbar = scene && scene._hotbarWindow;
        if (!window.RSTH_IH.HobarSlotsIndex) window.RSTH_IH.HobarSlotsIndex = 0;

        if (RSTH_DEBUG_LOG) console.warn("[getCurrentTool]window.RSTH_IH.HobarSlotsIndex", window.RSTH_IH.HobarSlotsIndex);

        const index = window.RSTH_IH.HobarSlotsIndex;
        const itemsid = hotbar.items[index].id;
        const items = $dataWeapons[itemsid] // この処理を呼び出すときはツールであることが確定しているため
        if (RSTH_DEBUG_LOG) console.warn("[getCurrentTool]items", items);

        return items;

    }

    // チェストの位置を設定
    window.RSTH_IH.calculateChestPosition = function (hotbarX, hotbarY, chestWidth, chestHeight) {
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        const below = window.RSTH_IH.HotbarPosition.startsWith("top");

        const invX = hotbarX + (window.RSTH_IH.Hotbarwidth - window.RSTH_IH.Inventorywidth) / 2;
        const invY = below
            ? hotbarY + window.RSTH_IH.Hotbarheight
            : hotbarY - window.RSTH_IH.Inventoryheight;

        const chestX = hotbarX + (window.RSTH_IH.Hotbarwidth - chestWidth) / 2;

        const chestY = below
            ? invY + window.RSTH_IH.Inventoryheight + 20   // インベントリの下 + 余白
            : invY - chestHeight - 20;                     // インベントリの上 - 余白

        return {
            x: Math.max(0, Math.min(chestX, gw - chestWidth)),
            y: Math.max(0, Math.min(chestY, gh - chestHeight))
        };
    };

    // 作業台ウィンドウの位置を計算
    window.RSTH_IH.calculateWorkbenchPosition = function (hotbarX, hotbarY) {
        const scene = SceneManager._scene;
        const gw = Graphics.boxWidth;
        const gh = Graphics.boxHeight;

        const below = window.RSTH_IH.HotbarPosition.startsWith("top"); // 上にあるホットバーなら下に表示
        const invX = hotbarX + (window.RSTH_IH.Hotbarwidth - window.RSTH_IH.Inventorywidth) / 2;
        const invY = below
            ? hotbarY + window.RSTH_IH.Hotbarheight + 10
            : hotbarY - window.RSTH_IH.Inventoryheight - 10;

        const wbX = hotbarX + (window.RSTH_IH.Hotbarwidth - window.RSTH_IH.Inventorywidth) / 2;
        const wbY = below
            ? invY + window.RSTH_IH.Inventoryheight + 10 + 32  // インベントリの下 + 余白
            : invY - window.RSTH_IH.Inventoryheight - 10 - 32;                     // インベントリの上 - 余白

        return {
            x: Math.max(0, Math.min(wbX, gw - window.RSTH_IH.Inventorywidth)),
            y: Math.max(0, Math.min(wbY, gh - wbY))
        };
    };


    // ウィンドウ内のD&D共通処理
    window.RSTH_IH.handleDragDropfromto = function (item, from, target, fromIndex) {
        if (RSTH_DEBUG_LOG) console.log(`[handleDragDropfromto]start`);
        const scene = SceneManager._scene;
        const hotbar = scene._hotbarWindow;
        const inv = scene._inventoryWindow;
        const chest = scene._chestWindow;
        inv.name = "inv";
        hotbar.name = "hotbar";
        chest.name = "chest";

        const invX = inv.canvasToLocalX(TouchInput.x);
        const invY = inv.canvasToLocalY(TouchInput.y);
        const invIndex = inv.hitTest(invX, invY);

        const hotbarX = hotbar.canvasToLocalX(TouchInput.x);
        const hotbarY = hotbar.canvasToLocalY(TouchInput.y);
        const hotbarIndex = hotbar.hitTest(hotbarX, hotbarY);

        const chestX = chest.canvasToLocalX(TouchInput.x);
        const chestY = chest.canvasToLocalY(TouchInput.y);
        const chestIndex = chest.hitTest(chestX, chestY);

        const shift = Input.isPressed("shift");
        const amount = shift ? (item.count || 1) : 1;

        const nonStackableTypes = ["weapon", "armor", "tool"];
        let moved = 0;
        let fromwindow = null;
        let targetwindow = null;

        if (from === "inventory") fromwindow = inv;
        if (from === "hotbar") fromwindow = hotbar;
        if (from === "chest") fromwindow = chest;

        if (target === "inventory") targetwindow = inv;
        if (target === "hotbar") targetwindow = hotbar;
        if (target === "chest") targetwindow = chest;

        const targetindexMap = {
            inv: invIndex,
            hotbar: hotbarIndex,
            chest: chestIndex
        };

        const fromSlot = fromwindow.items[fromIndex];
        const targetIndex = targetindexMap[targetwindow.name];
        const targetSlot = targetwindow.items[targetIndex];

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
                fromwindow.items[fromIndex] = null;
            }

        } else if (!targetSlot) {
            const toAdd = Math.min(window.RSTH_IH.StackSize, amount);
            const newItem = Object.assign({}, item);
            newItem.count = toAdd;
            targetwindow.items[targetIndex] = newItem;
            moved = toAdd;

            if (fromSlot.count > moved) {
                fromSlot.count -= moved;
            } else {
                fromwindow.items[fromIndex] = null;
            }

        } else {
            const tmp = targetwindow.items[targetIndex];
            targetwindow.items[targetIndex] = fromwindow.items[fromIndex];
            fromwindow.items[fromIndex] = tmp;
        }

        // 現在開いているチェストの位置を取得
        const chestPos = scene._openedChestPos;

        $gameSystem._customInventoryItems = inv.items;
        $gameSystem._customHotbarItems = hotbar.items;

        if (chestPos) {
            const chestObj = window.RSTH_IH.ChestManager.getChestAt(chestPos.x, chestPos.y);
            if (chestObj) {
                chestObj.items = chest.items.map(item => item ? JSON.parse(JSON.stringify(item)) : null);
            }
        }

        inv.refresh();
        hotbar.refresh();
        chest.refresh();
        if (RSTH_DEBUG_LOG) console.log(`[handleDragDropfromto]window.RSTH_IH.ChestManager._chests`, window.RSTH_IH.ChestManager._chests);
        if (RSTH_DEBUG_LOG) console.log(`[handleDragDropfromto]end`);
        return window.RSTH_IH.resetDragging();
    }

    // 作業台ウィンドウ用のグリッド描画処理
    window.RSTH_IH.drawItemSlotGridCrafting = function (win, items, cols, rows, tileSize, margin, selectedIndex, offsetY = 0) {
        const contents = win.contents;
        contents.clearRect(0, offsetY, contents.width, contents.height - offsetY);

        const max = cols * rows;
        if (!Array.isArray(items)) return;

        for (let i = 0; i < max; i++) {
            const item = items[i];
            const col = i % cols;
            const row = Math.floor(i / cols);

            const rect = new Rectangle(
                ((contents.width - (cols * tileSize + (cols - 1) * margin)) / 2) + col * (tileSize + margin),
                offsetY + row * (tileSize + margin),
                tileSize,
                tileSize
            );

            contents.paintOpacity = 128;
            contents.fillRect(rect.x, rect.y, rect.width, rect.height, "#8888ff");
            contents.paintOpacity = 255;

            if (item) {
                if (RSTH_DEBUG_LOG) console.warn("[drawItemSlotGridCrafting]item", item);
                const iconIndex = item.iconIndex || 0;
                const name = item.name || "???";

                const isCraftable = window.RSTH_IH.canCraft(item._recipe, $gameSystem._customInventoryItems, $gameSystem._customHotbarItems);
                win.changePaintOpacity(isCraftable);

                const pw = 32, ph = 32;
                const sx = (iconIndex % 16) * pw;
                const sy = Math.floor(iconIndex / 16) * ph;
                const bitmap = ImageManager.loadSystem("IconSet");

                contents.blt(bitmap, sx, sy, pw, ph, rect.x, rect.y, rect.width, rect.height);

                contents.fontSize = 16;
                contents.textColor = "#ffffff";
                contents.outlineColor = "#000000";
                contents.outlineWidth = 3;
                contents.drawText(name, rect.x + 38, rect.y + 4, rect.width - 38, tileSize - 8, "left");

                win.changePaintOpacity(true);
            }

            if (i === selectedIndex) {
                contents.strokeRect(rect.x, rect.y, rect.width, rect.height, "#ffffff", 5);
            }
        }
    };

    // ウィンドウを閉じる共通処理
    window.RSTH_IH.hideWindows = function () {
        const scene = SceneManager._scene;

        scene._inventoryWindow.hide();
        scene._inventoryWindow.deactivate();

        scene._chestWindow.hide();
        scene._chestWindow.deactivate();

        scene._workbenchWindow.hide();
        scene._workbenchWindow.deactivate();

        scene._equipmentWindow.hide();
        scene._equipmentWindow.deactivate();

        //カーソルをホットバーのインデックスへ
        if (scene._hotbarWindow && window.RSTH_IH.HobarSlotsIndex != null) {
            if (window.RSTH_IH.HobarSlotsIndex === -1) window.RSTH_IH.HobarSlotsIndex = 0;
            scene.updateCursorForSlot(window.RSTH_IH.HobarSlotsIndex, scene._hotbarWindow);
        }


        if (window.RSTH_IH.__popupOwner === scene._inventoryWindow) {
            const popup = scene._hoverTextSprite;
            if (popup) {
                popup.setText("");
            }
            window.RSTH_IH.__popupOwner = null;
        }

    }

    // 自動でオートタイル用shape画像を生成する処理
    // ゲーム配布時には不要。
    window.RSTH_IH.autotileGen = function (object) {
        const fs = require('fs');
        const path = require('path');

        for (const item of object) {
            if (!item || !item.meta) continue;
            if (item.meta.autoTile !== "true") continue;

            const tileType = (Number(item.meta.tileType) === 1) ? "wall" : "floor";
            const tileset = item.meta.tileset ?? "Outside_A2";
            const tileId = Number(item.meta.tileId ?? 1);
            const floorCache = window.RSTH_IH.FloorAutotileBitmaskToShape;
            const wallCache = window.RSTH_IH.WallAutotileBitmaskToShape;

            const cache = (tileType === "floor") ? floorCache : wallCache;
            const autotileTable = (tileType === "floor") ? Tilemap.FLOOR_AUTOTILE_TABLE : Tilemap.WALL_AUTOTILE_TABLE;
            const shapeMax = autotileTable.length;

            const tileCols = 16;
            const tileWidth = 48;
            const tileHeight = 48;
            const halfWidth = tileWidth / 2;
            const halfHeight = tileHeight / 2;

            const baseTileId = tileId - 1;
            const tx = baseTileId % tileCols;
            const ty = Math.floor(baseTileId / tileCols);
            const autotileCol = Math.floor(tx / 2) * 2;
            const autotileRow = ty;

            const srcPath = `img/tilesets/${tileset}`;
            const bitmap = ImageManager.loadBitmap('', srcPath);

            bitmap.addLoadListener(() => {
                const atlasCols = 16;
                const atlasRows = Math.ceil(shapeMax / atlasCols);
                const atlasBitmap = new Bitmap(tileWidth * atlasCols, tileHeight * atlasRows);

                const entries = Array.from(cache.entries());

                for (const [bitmask, shape] of entries) {
                    if (shape >= shapeMax) continue;
                    const table = autotileTable[shape];
                    const sxOffset = autotileCol * tileWidth;
                    const syOffset = autotileRow * tileHeight;

                    const partBitmap = new Bitmap(tileWidth, tileHeight);

                    for (let i = 0; i < 4; i++) {
                        const [qsx, qsy] = table[i];
                        const sx = sxOffset + qsx * halfWidth;
                        const sy = syOffset + qsy * halfHeight;
                        const dx = (i % 2) * halfWidth;
                        const dy = Math.floor(i / 2) * halfHeight;
                        partBitmap.blt(bitmap, sx, sy, halfWidth, halfHeight, dx, dy);
                    }

                    const cx = (shape % atlasCols) * tileWidth;
                    const cy = Math.floor(shape / atlasCols) * tileHeight;
                    atlasBitmap.blt(partBitmap, 0, 0, tileWidth, tileHeight, cx, cy);
                }
                const dataUrl = atlasBitmap._canvas.toDataURL('image/png');
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                const outDir = path.join(process.cwd(), 'img', 'tilesets');
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

                const fileName = `${tileType}_tileId${tileId}_${tileset}.png`;
                const outPath = path.join(outDir, fileName);
                fs.writeFileSync(outPath, buffer);
                if (RSTH_DEBUG_LOG) console.log(`保存完了: ${outPath}`);
            });
        }
    };

})();
