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

    //const SHOW_FPS = true;
    const SHOW_FPS = false;

    // 現在マップ上に配置されているブロックとブロックスプライトの一覧をコンソール表示
    window.RSTH_IH.getBlocks_and_Spriteslist = function (call) {
        if (!RSTH_DEBUG_LOG) return;
        console.log("[window.RSTH_IH.getBlocks_and_Spriteslist]現在マップ上に配置されているブロック一覧:", call);
        console.table(window.RSTH_IH.SurvivalBlockManager._blocks);

        console.log("[window.RSTH_IH.getBlocks_and_Spriteslist]現在マップ上に表示されているブロックスプライト一覧:", call);
        console.table(window.RSTH_IH.SurvivalBlockManager._sprites.map(sprite => ({
            x: sprite.block?.x,
            y: sprite.block?.y,
            tileId: sprite.block?.tileId,
            itemId: sprite.block?.itemId,
            growthStage: sprite.block?.growthStage,
            passable: sprite.block?.passable,
            _growthApplied: sprite.block?._growthApplied
        })));

        //console.log("[window.RSTH_IH.getBlocks_and_Spriteslist]現在マップ上に配置されているドロップアイテム一覧:", call);
        console.table(window.RSTH_IH.DropManager._drops);
    }

    // FPS表示
    if (SHOW_FPS) {
        (function () {
            const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
            Scene_Map.prototype.createAllWindows = function () {
                _Scene_Map_createAllWindows.call(this);
                this.createFpsDisplay();
            };

            Scene_Map.prototype.createFpsDisplay = function () {
                const sprite = new Sprite(new Bitmap(120, 24));
                sprite.x = Graphics.width - 130;
                sprite.y = 10;
                sprite.z = 9999;
                this._fpsDisplaySprite = sprite;
                this.addChild(sprite);

                this._fpsLastTime = performance.now();
                this._fpsFrameCount = 0;
                this._fpsCurrent = 0;
            };

            const _Scene_Map_update = Scene_Map.prototype.update;
            Scene_Map.prototype.update = function () {
                _Scene_Map_update.call(this);
                this.updateFpsDisplay();
            };

            Scene_Map.prototype.updateFpsDisplay = function () {
                this._fpsFrameCount++;
                const now = performance.now();
                if (now - this._fpsLastTime >= 200) {
                    const elapsed = now - this._fpsLastTime;
                    this._fpsCurrent = Math.round(this._fpsFrameCount * 1000 / elapsed);
                    this._fpsFrameCount = 0;
                    this._fpsLastTime = now;

                    const bmp = this._fpsDisplaySprite.bitmap;
                    bmp.clear();
                    bmp.fontSize = 20;
                    bmp.textColor = "#00ff00";
                    bmp.outlineColor = "#000000";
                    bmp.outlineWidth = 3;
                    bmp.drawText(`FPS: ${this._fpsCurrent}`, 0, 0, bmp.width, bmp.height, "right");
                }
            };
        })();
    }










})();
