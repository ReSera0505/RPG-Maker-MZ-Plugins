/*:
 * @target MZ
 * @plugindesc RSTH: イベント対応処理拡張プラグイン v1.0.1
 * @author ReSera_りせら
 *
 * @help
 * このプラグインは、RSTH_IH.jsで管理されるインベントリ・ホットバーに対して
 * 通常のイベントコマンド（アイテム減少・武器減少・防具減少）の代替処理を提供します。
 * さらに、インベントリ、ホットバー内に指定のアイテムを所持しているかの判定も可能です。
 * なお、アイテム等を増やす場合は通常のイベントコマンドを使用してください。
 *
 * ▼ 提供される関数（スクリプトコマンドで使用）
 * - RSTH_EventHelper.loseItem(itemId, amount)
 * - RSTH_EventHelper.loseWeapon(weaponId, amount)
 * - RSTH_EventHelper.loseArmor(armorId, amount)
 *
 * ※イベントコマンドの代わりに「スクリプト」や「プラグインコマンド」で使用可能です。
 *
 * ▼ 使用例
 * ◆スクリプト：
 *   RSTH_EventHelper.loseItem(1, 3); // ID:1のアイテムを3個消費
 * 
 * ▼ 使用方法
 * - プロジェクトの「js/plugins」フォルダにこのファイルを追加し、
 * - プラグインマネージャーから有効にしてください。
 * 
 * ▼ 注意事項
 * - RSTH_IH（インベントリ、ホットバー追加プラグイン）との連携を前提としています。
 * - RSTH_IHよりも**下に**に配置してください。
 * 
 * 
 * ▼ ライセンス
 * - このプラグインは MITライセンス の下で公開されています。
 * 
 * ----------------------------
 * 変更履歴:
 * ----------------------------
 * 
 * Ver.1.0.1 - 2025/06/05
 *   - ファイル名変更対応
 * 
 * Ver.1.0.0 - 2025/05/27
 *   - 初版公開
 * 
 * @command LoseWeapon
 * @text 武器の減少
 * @desc 指定した武器IDの武器をRSTHシステムから減少させる
 *
 * @arg weaponId
 * @type weapon
 * @text 武器
 * @desc 減少させる武器のID
 *
 * @arg amount
 * @type number
 * @text 数量
 * @default 1
 * @desc 減少させる数
 * 
 * @command LoseItem
 * @text アイテムの減少
 * @desc 指定したアイテムIDのアイテムをRSTHシステムから減少させる
 *
 * @arg itemId
 * @type item
 * @text アイテム
 * @desc 減少させるアイテムのID
 *
 * @arg amount
 * @type number
 * @text 数量
 * @default 1
 * @desc 減少させる数
 * 
 * @command LoseArmor
 * @text 防具の減少
 * @desc 指定した防具IDの防具をRSTHシステムから減少させる
 *
 * @arg armorId
 * @type armor
 * @text 防具
 * @desc 減少させる防具のID
 *
 * @arg amount
 * @type number
 * @text 数量
 * @default 1
 * @desc 減少させる数
 * 
 * @command HasItem
 * @text アイテム所持判定
 * @desc 指定したアイテムIDを所持しているかをスイッチに代入します
 *
 * @arg itemId
 * @type item
 * @text アイテム
 *
 * @arg switchId
 * @type switch
 * @text 結果格納スイッチ
 * @desc 所持していればON、なければOFFになります
 * 
 * @command HasWeapon
 * @text 武器所持判定
 * @desc 指定した武器IDを所持しているかをスイッチに代入します
 *
 * @arg weaponId
 * @type weapon
 * @text 武器
 *
 * @arg switchId
 * @type switch
 * @text 結果格納スイッチ
 * 
 * @command HasArmor
 * @text 防具所持判定
 * @desc 指定した防具IDを所持しているかをスイッチに代入します
 *
 * @arg armorId
 * @type armor
 * @text 防具
 *
 * @arg switchId
 * @type switch
 * @text 結果格納スイッチ
 */


(() => {
    "use strict";

    const RSTH_EventHelper = {};

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    //const RSTH_DEBUG_LOG = true;
    const RSTH_DEBUG_LOG = false;

    const filename = document.currentScript.src.match(/([^\/]+)\.js$/)[1];

    PluginManager.registerCommand(filename, "LoseItem", args => {
        if (RSTH_DEBUG_LOG) console.log(`[RSTH_EventHelper] Lose: start`);
        const itemId = Number(args.itemId || 0);
        const amount = Number(args.amount || 1);
        const item = $dataItems[itemId];
        if (item) {
            if (RSTH_DEBUG_LOG) console.log(`[RSTH_EventHelper] LoseItem: ${item.name} (${itemId}) x${amount}`);
            RSTH_EventHelper.loseItem(itemId, amount);
        }
    });


    PluginManager.registerCommand(filename, "LoseWeapon", args => {
        if (RSTH_DEBUG_LOG) console.log(`[RSTH_EventHelper] Lose: start`);
        const weaponId = Number(args.weaponId || 0);
        const amount = Number(args.amount || 1);
        const weapon = $dataWeapons[weaponId];
        if (weapon) {
            if (RSTH_DEBUG_LOG) console.log(`[RSTH_EventHelper] LoseWeapon: ${weapon.name} (${weaponId}) x${amount}`);
            RSTH_EventHelper.loseWeapon(weaponId, amount);
        }
    });

    PluginManager.registerCommand(filename, "LoseArmor", args => {
        if (RSTH_DEBUG_LOG) console.log(`[RSTH_EventHelper] Lose: start`);
        const armorId = Number(args.armorId || 0);
        const amount = Number(args.amount || 1);
        const armor = $dataArmors[armorId];
        if (armor) {
            if (RSTH_DEBUG_LOG) console.log(`[RSTH_EventHelper] LoseArmor: ${armor.name} (${armorId}) x${amount}`);
            RSTH_EventHelper.loseArmor(armorId, amount);
        }
    });

    PluginManager.registerCommand(filename, "HasItem", args => {
        const itemId = Number(args.itemId);
        const switchId = Number(args.switchId);
        const result = RSTH_EventHelper.hasItem(itemId);
        $gameSwitches.setValue(switchId, result);
    });

    PluginManager.registerCommand(filename, "HasWeapon", args => {
        const weaponId = Number(args.weaponId);
        const switchId = Number(args.switchId);
        const result = RSTH_EventHelper.hasWeapon(weaponId);
        $gameSwitches.setValue(switchId, result);
    });

    PluginManager.registerCommand(filename, "HasArmor", args => {
        const armorId = Number(args.armorId);
        const switchId = Number(args.switchId);
        const result = RSTH_EventHelper.hasArmor(armorId);
        $gameSwitches.setValue(switchId, result);
    });

    RSTH_EventHelper.hasItem = function (itemId) {
        const item = $dataItems[itemId];
        return !!item && window.RSTH_IH.hasItem(item);
    };

    RSTH_EventHelper.hasWeapon = function (weaponId) {
        const weapon = $dataWeapons[weaponId];
        return !!weapon && window.RSTH_IH.hasItem(weapon);
    };

    RSTH_EventHelper.hasArmor = function (armorId) {
        const armor = $dataArmors[armorId];
        return !!armor && window.RSTH_IH.hasItem(armor);
    };




    /**
     * 指定したIDの通常アイテムを RSTH の inventory/hotbar から減らす
     */
    RSTH_EventHelper.loseItem = function (itemId, amount = 1) {
        const item = $dataItems[itemId];
        if (!item) return;

        _loseFromCustomSlots(item, amount);
    };

    /**
     * 指定したIDの武器を RSTH の inventory/hotbar から減らす
     */
    RSTH_EventHelper.loseWeapon = function (weaponId, amount = 1) {
        const weapon = $dataWeapons[weaponId];
        if (!weapon) return;

        _loseFromCustomSlots(weapon, amount);
    };

    /**
     * 指定したIDの防具を RSTH の inventory/hotbar から減らす
     */
    RSTH_EventHelper.loseArmor = function (armorId, amount = 1) {
        const armor = $dataArmors[armorId];
        if (!armor) return;

        _loseFromCustomSlots(armor, amount);
    };

    /**
     * 内部処理: 指定アイテムを inventory → hotbar 順に消費
     */
    function _loseFromCustomSlots(item, amount) {
        let remain = amount;

        // 優先: inventory から消費
        window.RSTH_IH.removeItemFromInventoryOrHotbar(item, remain);

        // 画面更新
        const scene = SceneManager._scene;
        scene?.updateInventoryAndHotbar?.();
    }




})();
