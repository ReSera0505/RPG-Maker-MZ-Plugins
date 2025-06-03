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
            this.x = x;
            this.y = y;
            this.item = itemData;
            this.sprite = null;
            this._collected = false;
            this._retryCooldown = 0; // 追加：再試行までのクールダウン

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
            const iconIndex = drop.item.iconIndex;
            const sx = (iconIndex % 16) * 32;
            const sy = Math.floor(iconIndex / 16) * 32;
            sprite.setFrame(sx, sy, 32, 32);

            sprite.z = 1; // プレイヤーより下層に描画（通常プレイヤーは z=3 付近）

            // ▼ 初期位置を明示的に設定（1フレーム目描画前に）
            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const ox = $gameMap.displayX() * tw;
            const oy = $gameMap.displayY() * th;
            sprite.x = drop.x * tw - ox + 8;
            sprite.y = drop.y * th - oy + 8;

            sprite.update = function () {
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();
                const ox = $gameMap.displayX() * tw;
                const oy = $gameMap.displayY() * th;
                this.x = drop.x * tw - ox + 8;
                this.y = drop.y * th - oy + 8;
            };

            const spriteset = SceneManager._scene._spriteset;
            spriteset._tilemap.addChild(sprite);
            drop.sprite = sprite;
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


                if (dist <= 1) {
                    if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]回収可能距離に入りました (${drop.x},${drop.y}) → dist=${dist}`);
                    const success = window.RSTH_IH.gainItemToInventoryThenHotbar(drop.item, drop.item.count || 1);
                    if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]gainItem success=${success}`);
                    if (success) {
                        drop._collected = true;
                        if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]_collected フラグを true に設定: (${drop.x}, ${drop.y})`);
                        this.remove(drop);
                        if (RSTH_DEBUG_LOG) console.log(`[createSprite.update()]remove() 実行: (${drop.x}, ${drop.y})`);
                    } else {
                        drop._retryCooldown = 60; // 約1秒間再試行しない
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



})();