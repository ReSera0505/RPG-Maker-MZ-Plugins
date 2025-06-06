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




})();
