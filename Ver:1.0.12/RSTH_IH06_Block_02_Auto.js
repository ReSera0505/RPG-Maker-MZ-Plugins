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
    }

    window.RSTH_IH.Sprite_AutotileBlock.prototype = Object.create(Sprite.prototype);
    window.RSTH_IH.Sprite_AutotileBlock.prototype.constructor = window.RSTH_IH.Sprite_AutotileBlock;

    window.RSTH_IH.Sprite_AutotileBlock.prototype.initialize = function (block) {
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] start");
        Sprite.prototype.initialize.call(this);

        const item = $dataItems[block.itemId];
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] block", block);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] item", item);

        this._tileParts = [];

        this.block = block;
        this._tileWidth = 48;
        this._tileHeight = 48;
        this._halfWidth = this._tileWidth / 2;
        this._halfHeight = this._tileHeight / 2;

        // ▼ タイルセット読み込み
        const tilesetName = item.meta.tileset || "Outside_A2";
        this._tileset = ImageManager.loadAutotile(tilesetName);

        // ▼ 透明なビットマップを親スプライトに設定（描画枠の確保）
        this.bitmap = new Bitmap(this._tileWidth, this._tileHeight);
        this._rendered = false;

        this._tileType = Number(item.meta.tileType || 0);

        if (this._tileType === 1) {
            this._autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
            //this._shape = this._calculateWallShape();
        } else {
            this._autotileTable = Tilemap.FLOOR_AUTOTILE_TABLE;
        }
        this._shape = this._calculateShape();


        // ▼ タイル読み込み未完了ならリスナー追加して後から描画
        if (!this._tileset.isReady()) {
            this._tileset.addLoadListener(() => this._render());
        } else {
            this._render();
        }

        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] this._tileset", this._tileset);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] this._tileType", this._tileType);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] this._autotileTable", this._autotileTable);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] this._shape", this._shape);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][initialize] this.block", this.block);
    };

    window.RSTH_IH.Sprite_AutotileBlock.prototype._calculateShape = function () {
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_calculateShape] start");

        const manager = window.RSTH_IH.SurvivalBlockManager;
        const x = this.block.originX ?? this.block.x;
        const y = this.block.originY ?? this.block.y;
        const type = this.block.blockType;
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_calculateShape] this.block", this.block);

        // ↖↑↗→↘↓↙← の順に対応する方向とビット
        const bitOffsets = [
            { dx: -1, dy: -1, bit: 1 << 7 }, // ↖
            { dx: 0, dy: -1, bit: 1 << 6 }, // ↑
            { dx: 1, dy: -1, bit: 1 << 5 }, // ↗
            { dx: 1, dy: 0, bit: 1 << 4 }, // →
            { dx: 1, dy: 1, bit: 1 << 3 }, // ↘
            { dx: 0, dy: 1, bit: 1 << 2 }, // ↓
            { dx: -1, dy: 1, bit: 1 << 1 }, // ↙
            { dx: -1, dy: 0, bit: 1 << 0 }  // ←
        ];

        let bitmask = 0;

        for (const { dx, dy, bit } of bitOffsets) {
            const neighbor = manager.get(x + dx, y + dy);
            if (neighbor) {
                const item = $dataItems[neighbor.itemId];
                const neighborTileType = Number(item.meta.tileType || 0);

                if (item.meta.blockType === type &&
                    neighborTileType === this._tileType) {
                    bitmask |= bit;
                }
            }
        }

        let shape = null;
        if (this._tileType === 1) {
            shape = window.RSTH_IH.WallAutotileBitmaskToShape.get(bitmask);
        } else {
            shape = window.RSTH_IH.FloorAutotileBitmaskToShape.get(bitmask);
        }

        if (RSTH_DEBUG_LOG) {
            console.log("[_calculateShape] bitmask =", bitmask);
            console.log("[_calculateShape] shape =", shape);
        }

        return (this._tileType === 1) ? (shape ?? 15) : (shape ?? 46);
    };


    window.RSTH_IH.Sprite_AutotileBlock.prototype._render = function () {
        if (this._rendered) return;
        this._rendered = true;

        const table = this._autotileTable[this._shape];
        if (!table) return;

        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] this.block", this.block);
        const baseId = Number(this.block.tileId || 1) - 1;
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] baseId ", baseId);
        const tileCols = 16;
        const tileWidth = 48;
        const tileHeight = 48;
        const halfWidth = tileWidth / 2;
        const halfHeight = tileHeight / 2;

        const tx = baseId % tileCols;
        const ty = Math.floor(baseId / tileCols);

        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] tx", tx);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] ty", ty);

        // オートタイルの左上タイル（偶数列、3行単位に丸める）
        const autotileCol = Math.floor(tx / 2) * 2;
        const autotileRow = ty

        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] autotileCol", autotileCol);
        if (RSTH_DEBUG_LOG) console.log("[Sprite_AutotileBlock][_render] autotileRow", autotileRow);


        for (let i = 0; i < 4; i++) {
            const [qsx, qsy] = table[i];
            const sx = (autotileCol * tileWidth) + (qsx * halfWidth);
            const sy = (autotileRow * tileHeight) + (qsy * halfHeight);
            const dx = (i % 2) * halfWidth;
            const dy = Math.floor(i / 2) * halfHeight;

            let tilePart = this._tileParts[i];
            if (!tilePart) {
                tilePart = new Sprite(this._tileset);
                this._tileParts[i] = tilePart;
                this.addChild(tilePart);
            }

            tilePart.setFrame(sx, sy, halfWidth, halfHeight);
            tilePart.x = dx;
            tilePart.y = dy;
        }


        this.x = Math.round(this.block.x * tileWidth - $gameMap.displayX() * tileWidth);
        this.y = Math.round(this.block.y * tileHeight - $gameMap.displayY() * tileHeight);


        if (RSTH_DEBUG_LOG) {
            console.warn("[_render] autotile:", { autotileCol, autotileRow });
            console.warn("[_render] kind=", this._kind, "shape=", this._shape);
            console.warn("[_render] tileId=", this.block.tileId);
        }
    };

    window.RSTH_IH.Sprite_AutotileBlock.prototype.update = function () {
        Sprite.prototype.update.call(this);

        const tileWidth = $gameMap.tileWidth();
        const tileHeight = $gameMap.tileHeight();
        this.x = Math.round(this.block.x * tileWidth - $gameMap.displayX() * tileWidth);
        this.y = Math.round(this.block.y * tileHeight - $gameMap.displayY() * tileHeight);
    };

    // オートタイルに使用するタイルセットの読み込み
    ImageManager.loadAutotile = function (filename) {
        return ImageManager.loadBitmap("img/tilesets/", filename);
    };






})();
