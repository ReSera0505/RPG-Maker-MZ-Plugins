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
    // ブロックの成長処理関連===============================================================================================
    //=============================================================================================================


    // フレームごとに呼ばれる成長タイマー更新処理
    Game_System.prototype.rsthupdateGrowthTimers = function () {
        if (!this._growingTimers) this._growingTimers = [];

        if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]this._growingTimers`, this._growingTimers);
        for (const timer of this._growingTimers) {
            timer.time--;
            if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]timer`, timer);
            if (timer.time <= 0) {
                const block = window.RSTH_IH.SurvivalBlockManager.get(timer.x, timer.y);
                if (!block) continue;

                const item = $dataItems[block.itemId];
                if (!item || !item.meta.tileOffsets2) continue;

                // 追加: blockType が window.RSTH_IH.GrowBlock 以外ならスキップ
                if ((item.meta.blockType || "") !== window.RSTH_IH.GrowBlock) {
                    if (RSTH_DEBUG_LOG) console.warn(`[rsthupdateGrowthTimers] blockType !== window.RSTH_IH.GrowBlock によりスキップ`, block);
                    continue;
                }

                try {
                    const parsedOffsets = JSON.parse(item.meta.tileOffsets2);

                    // 成長ステージの更新（window.RSTH_IH.GrowBlock のみ）
                    block.growthStage = 1;

                    // 念のため growthTime も window.RSTH_IH.GrowBlock のみに制限（防衛策）
                    if ((item.meta.blockType || "") === window.RSTH_IH.GrowBlock) {
                        block.growthTime = 0; // 明示的に完了させる
                    }

                    window.RSTH_IH.__needGrowthSpriteUpdate = true;
                    if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]block`, block);
                    if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]block.growthStage`, block.growthStage);
                    if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers] (${block.x},${block.y}) が tileOffsets2 に成長しました`);

                    // 同期処理：SurvivalBlockManager._blocks側にも反映
                    const placedBlock = window.RSTH_IH.SurvivalBlockManager._blocks.find(b => b.x === block.x && b.y === block.y);
                    if (placedBlock) {
                        placedBlock.growthStage = 1;
                        if ((item.meta.blockType || "") === window.RSTH_IH.GrowBlock) {
                            placedBlock.growthTime = 0;
                        }
                    }

                } catch (e) {
                    if (RSTH_DEBUG_LOG) console.warn("[rsthupdateGrowthTimers] [成長処理エラー]", e);
                }

                timer.done = true;
            }
        }

        // 成長終了タイマーの除去
        this._growingTimers = this._growingTimers.filter(t => !t.done);
    };


    // 成長タイマーの追加
    Game_System.prototype.rsthstartGrowthTimer = function (x, y, time) {
        if (!this._growingTimers) this._growingTimers = [];

        const block = window.RSTH_IH.SurvivalBlockManager.get(x, y);
        if (!block) return;

        const item = $dataItems[block.itemId];
        if (!item || (item.meta.blockType || "") !== window.RSTH_IH.GrowBlock) return;

        this._growingTimers.push({ x, y, time });

        if (RSTH_DEBUG_LOG) console.log(`[rsthstartGrowthTimer] 成長開始 this._growingTimers`, this._growingTimers);
    };


})();