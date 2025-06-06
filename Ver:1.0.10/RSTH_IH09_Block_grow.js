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

        const px = $gamePlayer.x;
        const py = $gamePlayer.y;
        const rangeX = 30;
        const rangeY = 30;

        if (RSTH_DEBUG_LOG) console.warn(`[rsthupdateGrowthTimers] start`);
        if (RSTH_DEBUG_LOG) console.warn(`[rsthupdateGrowthTimers] this._growingTimers`, this._growingTimers);
        for (const timer of this._growingTimers) {
            if (Math.abs(timer.x - px) > rangeX || Math.abs(timer.y - py) > rangeY) {
                if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers] 範囲外スキップ (${timer.x}, ${timer.y})`);
                continue;
            }
            timer.time--;
            //if (RSTH_DEBUG_LOG) console.log(`[rsthupdateGrowthTimers]timer`, timer);
            if (timer.time <= 0) {
                const block = window.RSTH_IH.SurvivalBlockManager.get(timer.x, timer.y);
                if (!block) continue;

                const item = $dataItems[block.itemId];
                if (!item || !item.meta.tileOffsets2) continue;

                if (RSTH_DEBUG_LOG) console.warn(`[rsthupdateGrowthTimers] item`, item);
                // 追加: blockType が window.RSTH_IH.GrowBlock 以外ならスキップ
                if ((item.meta.blockType || "") !== window.RSTH_IH.GrowBlock) {
                    if (RSTH_DEBUG_LOG) console.warn(`[rsthupdateGrowthTimers] blockType !== window.RSTH_IH.GrowBlock によりスキップ`, block);
                    continue;
                }

                try {
                    const parsedOffsets = item._tileOffsets2Parsed || [];

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
                    if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("rsthupdateGrowthTimers_1");

                    // 同期処理：SurvivalBlockManager._blocks側にも反映
                    const placedBlock = window.RSTH_IH.SurvivalBlockManager._blocks.find(b => b.blockType === window.RSTH_IH.GrowBlock && b.x === block.x && b.y === block.y);
                    if (placedBlock) {
                        placedBlock.growthStage = 1;
                        if ((item.meta.blockType || "") === window.RSTH_IH.GrowBlock) {
                            placedBlock.growthTime = 0;
                        }
                    }
                    if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("rsthupdateGrowthTimers_2");

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

        const blocks = window.RSTH_IH.SurvivalBlockManager.getAll(x, y);
        if (!blocks || blocks.length === 0) return;

        if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("rsthstartGrowthTimer_1");
        if (RSTH_DEBUG_LOG) console.warn("[rsthstartGrowthTimer]blocks", blocks);

        for (const block of blocks) {
            const item = $dataItems[block.itemId];
            if (!item) continue;

            const blockType = item.meta.blockType || "";
            if (blockType !== window.RSTH_IH.GrowBlock) continue;

            this._growingTimers.push({ x, y, time });
            if (RSTH_DEBUG_LOG) console.log(`[rsthstartGrowthTimer] 成長タイマー追加: (${x}, ${y}) type=${blockType}`);
        }

        if (RSTH_DEBUG_LOG) window.RSTH_IH.getBlocks_and_Spriteslist("rsthstartGrowthTimer_2");
        if (RSTH_DEBUG_LOG) console.log(`[rsthstartGrowthTimer] 成長開始 this._growingTimers`, this._growingTimers);
    };


})();