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

    //=============================================================
    // window.RSTH_IH.Sprite_AutotileBlock（オートタイル専用スプライトクラス）
    //=============================================================
    window.RSTH_IH.Sprite_AutotileBlock = function (block) {
        this.initialize(block);
    };

    window.RSTH_IH.Sprite_AutotileBlock.prototype = Object.create(Sprite.prototype);
    window.RSTH_IH.Sprite_AutotileBlock.prototype.constructor = window.RSTH_IH.Sprite_AutotileBlock;

    window.RSTH_IH.Sprite_AutotileBlock.prototype.initialize = function (block) {
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] start");
        Sprite.prototype.initialize.call(this);

        this.bitmap = new Bitmap(48, 48);
        this._rendered = false;

        this.block = block;
        this._tileType = window.RSTH_IH.ItemTypeCache[block.itemId].tileType;

        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] block", block);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] this._tileType", this._tileType);

        this._tilesetName = window.RSTH_IH.ItemTypeCache[block.itemId].tileset;

        this._shape = this._calculateShape();

        // ロード完了確認してレンダリング開始
        const tileId = this.block.tileId;
        const typeName = (this._tileType === 1) ? "wall" : "floor";
        const tilesetName = this._tilesetName;
        const cacheAtlas = window.RSTH_IH.AutotileBitmapCache?.[tilesetName]?.[tileId]?.[typeName];

        if (cacheAtlas?.isReady()) {
            this._render();
        } else if (cacheAtlas) {
            cacheAtlas.addLoadListener(() => {
                setTimeout(() => this._render(), 0);
            });
        } else {
            console.error("[Autotile] Atlas not found at initialize:", tilesetName, tileId, typeName);
        }
    };

    window.RSTH_IH.Sprite_AutotileBlock.prototype._calculateShape = function () {
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_calculateShape] start");
        const manager = window.RSTH_IH.SurvivalBlockManager;
        const x = this.block.originX ?? this.block.x;
        const y = this.block.originY ?? this.block.y;
        const type = this.block.blockType;

        // キャッシュキーを作成
        const cacheKey = `${x},${y},${type},${this._tileType}`;

        // 世代管理されたキャッシュを参照
        const shapeCache = window.RSTH_IH.AutotileShapeBitmaskCache?.data?.[cacheKey];
        if (shapeCache !== undefined) {
            if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_calculateShape] cache hit:", shapeCache);
            return shapeCache;
        }

        // キャッシュになければ計算実行
        const bitmask = window.RSTH_IH.calculateAutotileBitmask(x, y, type, this._tileType);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_calculateShape] bitmask", bitmask);

        let shape;
        if (this._tileType === 1) {
            shape = window.RSTH_IH.WallAutotileBitmaskToShape.get(bitmask);
        } else {
            shape = window.RSTH_IH.FloorAutotileBitmaskToShape.get(bitmask);
        }
        shape = (this._tileType === 1) ? (shape ?? 15) : (shape ?? 46);

        // キャッシュ保存 (世代管理版)
        window.RSTH_IH.AutotileShapeBitmaskCache.data[cacheKey] = shape;

        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_calculateShape] cached shape", shape);
        return shape;
    };


    // bitmask取得処理
    window.RSTH_IH.calculateAutotileBitmask = function (x, y, type, tileType) {
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][calculateAutotileBitmask] start");
        const manager = window.RSTH_IH.SurvivalBlockManager;
        const offsets = [
            { dx: -1, dy: -1, bit: 1 << 7 },
            { dx: 0, dy: -1, bit: 1 << 6 },
            { dx: 1, dy: -1, bit: 1 << 5 },
            { dx: 1, dy: 0, bit: 1 << 4 },
            { dx: 1, dy: 1, bit: 1 << 3 },
            { dx: 0, dy: 1, bit: 1 << 2 },
            { dx: -1, dy: 1, bit: 1 << 1 },
            { dx: -1, dy: 0, bit: 1 << 0 }
        ];

        // 一括neighbors取得（範囲全体を1回で取る）
        const allNeighbors = offsets.map(({ dx, dy, bit }) => {
            return { bit, neighbors: manager.getAll(x + dx, y + dy) };
        });


        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][calculateAutotileBitmask] allNeighbors", allNeighbors);

        const bitmask = allNeighbors.reduce((acc, { bit, neighbors }) => {
            const hasSameType = neighbors.some(neighbor => {
                if (neighbor.blockType !== type) return false;
                const item = $dataItems[neighbor.itemId];
                if (!item?.meta) return false;
                const neighborTileType = window.RSTH_IH.ItemTypeCache[neighbor.itemId].tileType;
                return neighborTileType === tileType;
            });
            return acc | (hasSameType ? bit : 0);
        }, 0);

        return bitmask;
    }



    window.RSTH_IH.Sprite_AutotileBlock.prototype._render = function () {
        if (this._rendered) return;
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] start");
        this._rendered = true;

        const tileId = this.block.tileId;

        const typeName = (this._tileType === 1) ? "wall" : "floor";
        const tilesetName = this._tilesetName;

        const cacheAtlas = window.RSTH_IH.AutotileBitmapCache?.[tilesetName]?.[tileId]?.[typeName];
        if (!cacheAtlas) {
            console.error("[Autotile] Atlas not found:", tilesetName, tileId, typeName);
            return;
        }

        const shape = this._shape;
        const tileWidth = 48;
        const tileHeight = 48;
        const cols = 16;
        const sx = (shape % cols) * tileWidth;
        const sy = Math.floor(shape / cols) * tileHeight;

        const partBitmap = new Bitmap(tileWidth, tileWidth);
        partBitmap.blt(cacheAtlas, sx, sy, tileWidth, tileWidth, 0, 0);
        const partSprite = new Sprite(partBitmap);
        partSprite.x = 0;
        partSprite.y = 0;
        this.addChild(partSprite);

        this.x = Math.round(this.block.x * tileWidth - $gameMap.displayX() * tileWidth);
        this.y = Math.round(this.block.y * tileHeight - $gameMap.displayY() * tileHeight);

    };


    window.RSTH_IH.Sprite_AutotileBlock.prototype.update = function () {
        Sprite.prototype.update.call(this);

        const mapWidth = $gameMap.tileWidth();
        const mapHeight = $gameMap.tileHeight();
        this.x = Math.round(this.block.x * mapWidth - $gameMap.displayX() * mapWidth);
        this.y = Math.round(this.block.y * mapHeight - $gameMap.displayY() * mapHeight);
    };


    /*
    // オートタイルに使用するタイルセットの読み込み
    ImageManager.loadAutotile = function (filename) {
        return ImageManager.loadBitmap("img/tilesets/", filename);
    };
    */

    /*
    // 起動時に呼び出す
    window.RSTH_IH.buildAutotileShapeCacheForTileset = function (tilesetName, tileset) {
        const tileCols = 16;
        const tileWidth = 48;
        const tileHeight = 48;
        const halfWidth = tileWidth / 2;
        const halfHeight = tileHeight / 2;

        window.RSTH_IH.AutotileShapeCache[tilesetName] = {};

        const columns = 16;
        const rows = Math.floor(tileset.height / 48);
        const maxLocalTileId = columns * rows;

        for (let localTileId = 0; localTileId < maxLocalTileId; localTileId++) {
            window.RSTH_IH.AutotileShapeCache[tilesetName][localTileId] = {};

            const tx = localTileId % tileCols;
            const ty = Math.floor(localTileId / tileCols);
            const autotileCol = Math.floor(tx / 2) * 2;
            const autotileRow = ty;

            const autotileTables = {
                floor: Tilemap.FLOOR_AUTOTILE_TABLE,
                wall: Tilemap.WALL_AUTOTILE_TABLE
            };

            for (const [typeName, autotileTable] of Object.entries(autotileTables)) {
                for (let shape = 0; shape < autotileTable.length; shape++) {
                    const table = autotileTable[shape];
                    const quarterRects = [];

                    for (let i = 0; i < 4; i++) {
                        const [qsx, qsy] = table[i];
                        const sx = (autotileCol * tileWidth) + (qsx * halfWidth);
                        const sy = (autotileRow * tileHeight) + (qsy * halfHeight);
                        const dx = (i % 2) * halfWidth;
                        const dy = Math.floor(i / 2) * halfHeight;

                        quarterRects.push({ sx, sy, dx, dy });
                    }

                    if (!window.RSTH_IH.AutotileShapeCache[tilesetName][localTileId][typeName]) {
                        window.RSTH_IH.AutotileShapeCache[tilesetName][localTileId][typeName] = {};
                    }
                    window.RSTH_IH.AutotileShapeCache[tilesetName][localTileId][typeName][shape] = quarterRects;
                }
            }
        }

        if (RSTH_DEBUG_LOG) console.log(`[buildAutotileShapeCacheForTileset] 完了: ${tilesetName}`);
    };

    window.RSTH_IH.buildAutotileBitmapCacheForTileset = function (tilesetName, tileset) {
        const tileCols = 16;
        const tileWidth = 48;
        const tileHeight = 48;
        const halfWidth = tileWidth / 2;
        const halfHeight = tileHeight / 2;

        window.RSTH_IH.AutotileBitmapCache[tilesetName] = {};

        const columns = 16;
        const rows = Math.floor(tileset.height / tileHeight);
        const maxLocalTileId = columns * rows;

        for (let localTileId = 0; localTileId < maxLocalTileId; localTileId++) {
            window.RSTH_IH.AutotileBitmapCache[tilesetName][localTileId] = {};

            const tx = localTileId % tileCols;
            const ty = Math.floor(localTileId / tileCols);
            const autotileCol = Math.floor(tx / 2) * 2;
            const autotileRow = ty;

            const autotileTables = {
                floor: Tilemap.FLOOR_AUTOTILE_TABLE,
                wall: Tilemap.WALL_AUTOTILE_TABLE
            };

            for (const [typeName, autotileTable] of Object.entries(autotileTables)) {
                for (let shape = 0; shape < autotileTable.length; shape++) {
                    const table = autotileTable[shape];
                    const bitmap = new Bitmap(tileWidth, tileHeight);

                    for (let i = 0; i < 4; i++) {
                        const [qsx, qsy] = table[i];
                        const sx = (autotileCol * tileWidth) + (qsx * halfWidth);
                        const sy = (autotileRow * tileHeight) + (qsy * halfHeight);
                        const dx = (i % 2) * halfWidth;
                        const dy = Math.floor(i / 2) * halfHeight;

                        bitmap.blt(tileset, sx, sy, halfWidth, halfHeight, dx, dy);
                    }

                    if (!window.RSTH_IH.AutotileBitmapCache[tilesetName][localTileId][typeName]) {
                        window.RSTH_IH.AutotileBitmapCache[tilesetName][localTileId][typeName] = {};
                    }
                    window.RSTH_IH.AutotileBitmapCache[tilesetName][localTileId][typeName][shape] = bitmap;
                }
            }
        }

        if (RSTH_DEBUG_LOG) console.log(`[buildAutotileBitmapCacheForTileset] 完了: ${tilesetName}`);
    };
*/
    /*
    // 例：Floor側
    function exportFloorAutotileCache() {
        const obj = Object.fromEntries(window.RSTH_IH.FloorAutotileBitmaskToShape);
        const json = JSON.stringify(obj, null, 2);
        console.log(json);
    }
    exportFloorAutotileCache();

    function exportWallAutotileCache() {
        const obj = Object.fromEntries(window.RSTH_IH.WallAutotileBitmaskToShape);
        const json = JSON.stringify(obj, null, 2);
        console.log(json);
    }
    exportWallAutotileCache();
*/



})();
