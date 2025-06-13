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
    // チェストウィンドウ===============================================================================================
    //=============================================================================================================
    window.RSTH_IH.Window_Chest = class extends Window_Selectable {
        // コンストラクタ内でパディングを定義
        constructor(rect) {
            super(rect);
            this.items = [];
            this.tileSize = window.RSTH_IH.InventorySlotSize;
            this.margin = window.RSTH_IH.Inventorymargin;  // アイテム間のマージン
            this.padding = window.RSTH_IH.Inventorypadding;
            this._lastClickTime = null;
            this._lastClickIndex = null;
            this._cols = window.RSTH_IH.InventoryCols;
            this._rows = window.RSTH_IH.InventoryRows;
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
            const maxItemsSize = this._cols * this._rows;
            return maxItemsSize;
        }

        // 列数を強制設定（9列）
        maxCols() {
            return this._cols;
        }

        // 行数を強制設定（4行）
        maxRows() {
            return this._rows;
        }

        setSize(cols, rows) {
            this._cols = cols;
            this._rows = rows;
            this.updateContentsSize();
            this.refresh();
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
            if (RSTH_DEBUG_LOG) console.log("[Window_Chest]refresh描画開始");
            const scene = SceneManager._scene;
            let currentItems = [];

            if (scene._openedChestPos) {
                const chest = window.RSTH_IH.ChestManager.getChestAt(scene._openedChestPos.x, scene._openedChestPos.y);
                if (chest) {
                    currentItems = chest.items;
                }
            }
            this.items = currentItems;

            window.RSTH_IH.drawItemSlotGrid(this, this.items, this._cols, this._rows, this.tileSize, this.margin, this.selectedIndex);
            this.hoverCache = [...this.items];

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

        updateContentsSize() {
            const width = this._cols * this.tileSize + (this._cols - 1) * this.margin + this.padding;
            const height = this._rows * this.tileSize + (this._rows - 1) * this.margin + this.padding;
            this.contents.resize(width, height);
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
            window.RSTH_IH.handleSlotTouchChest(this, "chest", this.items);
        }

        processCursorMove() { }

        canvasToLocalX(globalX) {
            return globalX - this.x - this.padding;
        }

        canvasToLocalY(globalY) {
            return globalY - this.y - this.padding;
        }

        setItems(items) {
            window.RSTH_IH.setItemsSafe(this, items, "_customChestItems");
            if (RSTH_DEBUG_LOG) console.log("[Window_Chest]setItemsSafe実行");
            this.refresh();
        }

        update() {
            Window_Selectable.prototype.update.call(this);
            this.updateHoverText();
        }

        updateHoverText() {
            window.RSTH_IH.updateHoverTextShared(this, this.items);
        }

        hide() {
            Window_Selectable.prototype.hide.call(this);
            if (window.RSTH_IH.__popupOwner === this) {
                const popup = SceneManager._scene._hoverTextSprite;
                if (popup) popup.setText("");
                window.RSTH_IH.__popupOwner = null;
            }
            if (SceneManager._scene?._rsthCursorSprite) {
                SceneManager._scene._rsthCursorSprite.visible = false;
            }
        }

    }

    window.RSTH_IH.ChestManager = {
        _chests: [], // 各チェストオブジェクトを保持

        addChest(x, y, cols, rows) {
            const newChest = {
                x,
                y,
                cols,
                rows,
                items: [] // 中身のアイテム配列
            };
            this._chests.push(newChest);
            return newChest;
        },

        getChestAt(x, y) {
            return this._chests.find(c => c.x === x && c.y === y);
        },

        removeChestAt(x, y) {
            this._chests = this._chests.filter(c => !(c.x === x && c.y === y));
        }
    }

    //=============================================================================================================
    // 作業台ウィンドウ===============================================================================================
    //=============================================================================================================
    window.RSTH_IH.Window_Workbench = class extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this.recipes = []; // レシピ情報を格納（アイテムID、必要素材など）
            this.slots = [];
            this.tileSize = window.RSTH_IH.InventorySlotSize;
            this.margin = window.RSTH_IH.Inventorymargin;
            this.padding = window.RSTH_IH.Inventorypadding;
            this._lastClickTime = null;
            this._lastClickIndex = null;
            this.selectedIndex = -1;
            this._cols = window.RSTH_IH.InventoryCols;
            this._rows = window.RSTH_IH.InventoryRows;
            this.hoverCache = new Array(this.maxItems()).fill(null);
            this.titleHeight = 32;

            for (let i = 0; i < this.slots.length; i++) {
                this.hoverCache[i] = this.slots[i];
            }


            this.refresh();


            this._mouseHandlersSet = true;
            this.select(-1); // カーソル非表示
        }


        maxItems() {
            return this.recipes.length;
        }

        // 列数を強制設定
        maxCols() {
            return this._cols;
        }

        // 行数を強制設定
        maxRows() {
            if (!this.recipes) return 1;
            const currentRows = this._rows;
            const itemCount = this.recipes.length;
            const neededRows = Math.ceil(itemCount / this.maxCols());
            const extraRows = Math.max(0, neededRows - currentRows);
            return currentRows + extraRows;
        }

        itemRect(index) {
            const col = index % this.maxCols();
            const row = Math.floor(index / this.maxCols());
            const totalContentWidth = this.maxCols() * this.tileSize + (this.maxCols() - 1) * this.margin;
            const startX = (this.contentsWidth() - totalContentWidth) / 2;
            const titleOffsetY = this.titleHeight; // タイトル分の高さ

            const x = startX + col * (this.tileSize + this.margin);
            const y = titleOffsetY + row * (this.tileSize + this.margin);

            return new Rectangle(x, y, this.tileSize, this.tileSize);
        }

        setRecipes(recipes) {
            if (RSTH_DEBUG_LOG) console.log(`[setRecipes(recipes)]start`);
            this.recipes = recipes || [];
            this.hoverCache = [...this.recipes];

            // 作成アイテムの情報を取得して表示準備（アイテムデータとして扱えるようにする）
            this.slots = this.recipes.map(recipe => {
                const item = $dataItems[recipe.resultItemId];
                if (RSTH_DEBUG_LOG) console.log(`[setRecipes(recipes)]item`, item);
                return {
                    id: recipe.resultItemId,
                    type: "item",
                    iconIndex: item?.iconIndex ?? 0,
                    name: item?.name ?? "不明なアイテム",
                    count: recipe.resultCount || 1,
                    _recipe: recipe  // レシピ情報を内部保持
                };
            });

            if (RSTH_DEBUG_LOG) console.log(`[setRecipes(recipes)]this.recipes`, this.recipes);
            if (RSTH_DEBUG_LOG) console.log(`[setRecipes(recipes)]this.hoverCache`, this.hoverCache);
            if (RSTH_DEBUG_LOG) console.log(`[setRecipes(recipes)]this.slots`, this.slots);
            if (RSTH_DEBUG_LOG) console.log(`[setRecipes(recipes)]end`);
            this.refresh();
        }

        refresh() {
            if (RSTH_DEBUG_LOG) console.log("[Window_Workbench]refresh描画開始");
            this.contents.clear();


            const titleHeight = this.titleHeight; // タイトル表示用スペース

            // タイトル描画
            this.contents.fontSize = 18;
            this.contents.textColor = "#ffffff";
            this.contents.outlineColor = "#000000";
            this.contents.outlineWidth = 4;
            this.contents.drawText("Workbench", 0, 0, this.contents.width, titleHeight, "center");

            const inventory = $gameSystem._customInventoryItems || [];
            const hotbar = $gameSystem._customHotbarItems || [];

            this.items = this.slots || []; // ← 作業台用はレシピの描画
            if (RSTH_DEBUG_LOG) console.log(`[refresh()]this.items`, this.items);

            window.RSTH_IH.drawItemSlotGridCrafting(this, this.items, this.maxCols(), this.maxRows(), this.tileSize, this.margin, this.selectedIndex, titleHeight);

            this.hoverCache = [...this.items];

            if (RSTH_DEBUG_LOG) console.log(`[refresh()]this.hoverCache`, this.hoverCache);

            const scene = SceneManager._scene;
            const sprite = scene?._rsthCursorSprite;

            if (sprite) {
                if (!this.visible || this.openness <= 0 || this.selectedIndex < 0) {
                    sprite.visible = false;
                } else if (scene.updateCursorForSlot) {
                    scene.updateCursorForSlot(this.selectedIndex, this);
                }
            }
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

            const x = this.canvasToLocalX(TouchInput.x);
            const y = this.canvasToLocalY(TouchInput.y);
            const index = this.hitTest(x, y);

            if (TouchInput.isReleased() && index >= 0) {
                const now = performance.now();
                const doubleClicked =
                    this._lastClickIndex === index && now - (this._lastClickTime || 0) < 300;

                this._lastClickTime = now;
                this._lastClickIndex = index;

                if (doubleClicked) {
                    const recipe = this.recipes[index];
                    if (recipe) {
                        let count = 1;

                        if (Input.isPressed("shift") && Input.isPressed("control")) {
                            // 最大数
                            count = window.RSTH_IH.getMaxCraftCount(recipe, $gameSystem._customInventoryItems, $gameSystem._customHotbarItems);
                        } else if (Input.isPressed("shift")) {
                            // 10個
                            count = 10;
                        }

                        if (RSTH_DEBUG_LOG) {
                            console.log(`[Workbench] ダブルクリックで作成 index=${index}`);
                            console.log(`[Workbench] 作成個数=${count} recipe=`, recipe);
                        }

                        window.RSTH_IH.handleCraftItem?.(recipe, count);
                    }
                }
            }
        }



        maxScrollY() {
            const wheight = window.RSTH_IH.Inventoryheight;
            const rowHeight = this.itemHeight();
            const maxRows = Math.ceil(this.maxItems() / this.maxCols());
            const visibleRows = Math.floor((wheight - rowHeight) / rowHeight);
            return Math.max(0, (maxRows - visibleRows) * rowHeight - this.padding);
        }

        processCursorMove() { }


        canvasToLocalX(globalX) {
            return globalX - this.x - this.padding;
        }

        canvasToLocalY(globalY) {
            return globalY - this.y - this.padding;
        }

        update() {
            Window_Selectable.prototype.update.call(this);
            window.RSTH_IH.updateHoverTextShared(this, this.slots);
        }

        hide() {
            Window_Selectable.prototype.hide.call(this);
            if (window.RSTH_IH.__popupOwner === this) {
                const popup = SceneManager._scene._hoverTextSprite;
                if (popup) popup.setText("");
                window.RSTH_IH.__popupOwner = null;
            }
            if (SceneManager._scene?._rsthCursorSprite) {
                SceneManager._scene._rsthCursorSprite.visible = false;
            }
        }
    };

    Scene_Map.prototype.showWorkbench = function () {
        if (!this._workbenchWindow) return;

        this._workbenchWindow.setRecipes(window.RSTH_IH.getCraftingRecipesFromKnownSkills($gameParty.leader()));
        this._workbenchWindow.show();
        this._workbenchWindow.activate();
    };


    window.RSTH_IH.canCraft = function (recipe, inventory, hotbar) {
        if (RSTH_DEBUG_LOG) console.log(`[canCraft]start`);
        if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) return false;

        // インベントリ＋ホットバーを一つのリストに統合（null を除外）
        const combined = [...(inventory || []), ...(hotbar || [])].filter(item => item);

        for (const ingredient of recipe.ingredients) {
            const requiredId = ingredient.id;
            const requiredCount = ingredient.count;

            // 合計所持数を計算
            let total = 0;
            for (const item of combined) {
                if (item.id === requiredId) {
                    total += item.count || 0;
                }
            }

            if (total < requiredCount) {
                return false; // 1つでも足りないものがあれば作成不可
            }
        }

        return true;
    };

    window.RSTH_IH.handleCraftItem = function (recipe, count = 1) {
        if (RSTH_DEBUG_LOG) console.log(`[handleCraftItem]start`);
        const inventory = $gameSystem._customInventoryItems || [];
        const hotbar = $gameSystem._customHotbarItems || [];

        // 合計作成数に応じた材料数を確保できるかチェック
        const canCraftCount = window.RSTH_IH.getMaxCraftCount(recipe, inventory, hotbar);
        if (canCraftCount < count) {
            if (RSTH_DEBUG_LOG) console.warn(`[handleCraftItem] 材料不足: 要求=${count}, 可能=${canCraftCount}`);
            return;
        }
        /*
                // 空きスロットがあるかチェック（最低1スロット以上必要）
                const emptySlotIndexInInv = inventory.findIndex(i => !i);
                const emptySlotIndexInHot = hotbar.findIndex(i => !i);
                if (emptySlotIndexInInv < 0 && emptySlotIndexInHot < 0) {
                    if (RSTH_DEBUG_LOG) console.warn("[handleCraftItem] 空きスロットがありません。");
                    return;
                }
        */
        // 材料をインベントリ＋ホットバーから削除
        const allSlots = [...inventory, ...hotbar];
        for (const ingredient of recipe.ingredients) {
            let remaining = ingredient.count * count;
            for (let i = 0; i < allSlots.length; i++) {
                const item = allSlots[i];
                if (item && item.id === ingredient.id) {
                    const take = Math.min(item.count, remaining);
                    item.count -= take;
                    remaining -= take;
                    if (item.count <= 0) {
                        allSlots[i] = null;
                    }
                    if (remaining <= 0) break;
                }
            }
        }

        // インベントリとホットバーに再分割して保存
        $gameSystem._customInventoryItems = allSlots.slice(0, inventory.length);
        $gameSystem._customHotbarItems = allSlots.slice(inventory.length);
        if (SceneManager._scene._inventoryWindow) SceneManager._scene._inventoryWindow.refresh();
        if (SceneManager._scene._hotbarWindow) SceneManager._scene._hotbarWindow.refresh();

        // 作成アイテム
        const resultItem = $dataItems[recipe.resultItemId];
        const totalResultCount = (recipe.resultCount || 1) * count;

        // アイテムを追加
        const success = window.RSTH_IH.gainItemToInventoryThenHotbar(resultItem, totalResultCount);
        if (!success) {
            if (RSTH_DEBUG_LOG) console.warn("[handleCraftItem] アイテムの格納に失敗しました。");
        } else {
            if (RSTH_DEBUG_LOG) console.log(`[handleCraftItem] 作成完了: ${resultItem.name} x${totalResultCount}`);
        }
    };


    window.RSTH_IH.parseCraftingRecipesFromSkills = function () {
        if (RSTH_DEBUG_LOG) console.log(`[parseCraftingRecipesFromSkills]start`);
        const recipes = [];

        for (const skill of $dataSkills) {
            if (!skill || !skill.meta || !skill.meta.itemId) continue;

            const resultId = Number(skill.meta.itemId);
            const resultCount = Number(skill.meta.resultCount) || 1;

            let ingredients = [];
            try {
                ingredients = JSON.parse(skill.meta.ingredients || "[]");
            } catch (e) {
                console.error("[parseCraftingRecipesFromSkills] ingredients parse error:", e, skill);
                continue;
            }

            // 構造体として追加
            recipes.push({
                id: resultId,
                result: resultId,
                resultCount: resultCount,
                ingredients: ingredients
            });
        }

        // 読み取ったレシピをプレイヤーが使えるレシピとして登録
        $gameParty.rsthKnownRecipes = recipes;
        if (RSTH_DEBUG_LOG) console.log(`[parseCraftingRecipesFromSkills]$gameParty.rsthKnownRecipes`, $gameParty.rsthKnownRecipes);
    };

    window.RSTH_IH.getCraftingRecipesFromKnownSkills = function (actor) {
        if (RSTH_DEBUG_LOG) console.log(`[getCraftingRecipesFromKnownSkills]start`);
        if (!actor || typeof actor.skills !== "function") return [];

        const recipes = [];

        for (const skill of actor.skills()) {
            if (!skill || !skill.meta || !skill.meta.itemId || !skill.meta.ingredients) continue;

            const itemId = Number(skill.meta.itemId);
            const resultCount = Number(skill.meta.resultCount || 1);
            let ingredients = [];

            try {
                ingredients = JSON.parse(skill.meta.ingredients);
            } catch (e) {
                if (RSTH_DEBUG_LOG) console.warn(`[getCraftingRecipesFromKnownSkills] 材料のJSON解析に失敗:`, skill.meta.ingredients);
                continue;
            }

            recipes.push({
                skillId: skill.id,
                resultItemId: itemId,
                resultCount,
                ingredients,
            });
        }

        if (RSTH_DEBUG_LOG) console.log(`[getCraftingRecipesFromKnownSkills]recipes`, recipes);
        return recipes;
    };

    window.RSTH_IH.getMaxCraftCount = function (recipe, inventory, hotbar) {
        if (!recipe.ingredients) return 0;

        let max = Infinity;
        for (const ing of recipe.ingredients) {
            const total = window.RSTH_IH.countItemInContainers(ing.id, inventory, hotbar);
            const possible = Math.floor(total / ing.count);
            max = Math.min(max, possible);
        }
        return max;
    };

    window.RSTH_IH.countItemInContainers = function (itemId, inventory, hotbar) {
        const all = [...(inventory || []), ...(hotbar || [])];
        let total = 0;

        for (const item of all) {
            if (item && item.id === itemId) {
                total += item.count || 0;
            }
        }

        return total;
    };


})();