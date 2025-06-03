/*:
 * @target MZ
 * @plugindesc RSTH_IH: サバイバルゲームシステムプラグイン ver1.0.8
 * @author ReSera_りせら
 *
 * @help
 * このプラグインはマップ画面にインベントリとホットバーUIを追加し、
 * プレイヤーの持ち物やショートカットバー（ホットバー）を視覚的に管理できます。
 * マップ上にブロックを設置・破壊できる機能を追加し、
 * ツールによるブロック破壊や、破壊時のドロップ、ドロップアイテムの回収、
 * ドロップの永続保存、通行制御など、サバイバル要素の実装に対応しています。
 *
 * ▼ 主な機能
 * - マウスによるドラッグ＆ドロップでインベントリやホットバー間のアイテム移動が可能
 * - Shiftキー押下によるアイテムの一括移動
 * - ホットバーは数字キー（1～0）、マウスホイール、[]キー（変更可能）でスロットを選択できます。
 * - スタック（所持数の管理。プラグインパラメータで変更可能）対応
 * - マップ表示画面中に右クリックでメニューは開きません。(escキーでメニュー開閉可能)
 * - 左クリックでプレイヤーは移動しません。
 * - WASDキーと矢印キーでプレイヤーを移動できます。（斜め移動も可能）
 * - shiftを押しながら移動するとダッシュできます。（MZ標準機能)
 * - ctrlを押しながら移動すると平行移動ができます。
 * - イベントをマウスオーバーするとマウスポインタが変化します。
 * - 周囲3マス以内にあるイベントを右クリックで会話が可能です。
 * - **マウスポインタの画像はimg/system/にMousePoints.pngを入れてください**
 * - MousePoints.pngは48x48の横2列で作成してください。（つまり縦48横96の画像を2つに分割して使用する)
 * - 
 * - インベントリ、ホットバー内のアイテムをダブルクリックで使用可能（アイテム、防具に対応）
 * - ブロックを設置できるアイテムをホットバーで選択している場合、
 * - 周囲3マス以内の障害物がないマスにブロックを設置できます。
 * - ホットバーで選択されているポーション等のアイテムはマップ画面内で右クリックでも使用可能です。
 * - ホットバーで選択されている武器やツールはマップ画面内でプレイヤー周囲3マス以内で左クリックで使用可能です。
 * - ツール（toolタグ付き武器）で指定ブロックのみ破壊可能
 * - ブロック破壊時にアイテムをドロップ、近づくと自動回収
 * - 配置済みブロックとドロップはセーブデータに保存される
 * - ブロックはタイルID（tileId）で指定、タイルセット画像を使用
 * - ブロックには通行不可になる通行判定制御、
 * - プレイヤーより上層か下層に表示する設定もあります。
 *
 * ▼ 注意事項
 * - 通常の "gainItem" でインベントリ、ホットバーに追加されるようになりました。
 * 
 * - 入手したアイテムはインベントリが満杯になるとホットバーへ格納されます。
 *   ホットバーも満杯の場合にアイテムを入手するとあふれたものは削除されます。
 *   （今後マップにドロップするように改善する予定）
 * 
 * - 使用後のアイテムは自動的に1個減少し、0になればスロットが空になります。
 * - 通常のアイテム所持数と連動せず、内部的に "_customInventoryItems", "_customHotbarItems" に保持されます。
 * 
 * - グローバル汚染を避けるため、window.RSTH_IH 名前空間を使用しています。
 * - ドロップされたアイテムは自動でアイコン表示され、近づくと自動取得されます。
 * - 通行判定をオーバーライドしているため、マップタイルの通行不可と併用注意。
 * 
 * ▼ 使用方法
 * プロジェクトの「js/plugins」フォルダに以下の順で全てのファイルを追加し、
 * プラグインマネージャーから全て有効にしてください。
 * RSTH_IH01_Core.js
 * RSTH_IH02_Util_01.js
 * RSTH_IH02_Util_02.js
 * RSTH_IH02_Util_03.js
 * RSTH_IH03_Gain.js
 * RSTH_IH04_Handle.js
 * RSTH_IH05_Window.js
 * RSTH_IH06_UseItem.js
 * RSTH_IH07_Block_dropitem.js
 * RSTH_IH08_Block_Main.js
 * RSTH_IH09_Block_grow.js
 * RSTH_IH10_SaveLoad.js
 * RSTH_IH11_Debug.js
 * RSTH_IH12_EventHelper.js 
 * 
 * マップ画面で "E" キーを押すとインベントリと装備ウィンドウが開閉します。
 * 
 * ブロックを設置するアイテムのメモ欄には以下のようなメタタグを設定してください：
 *
 * ▼ ブロックアイテムのメタタグ例（通常アイテムとして作成）
 * <block>
 * <tileId:172>
 * <blockName:ドラゴンの石像>
 * <size:[2,2]>
 * <tileset:Inside_C>
 * <tileOffsets1:[
 *   {"dx":0,"dy":0,"tileId":172,"passable":true,"blockZ":"over"},
 *   {"dx":1,"dy":0,"tileId":173,"passable":true,"blockZ":"over"},
 *   {"dx":0,"dy":1,"tileId":188,"passable":false,"blockZ":"under"},
 *   {"dx":1,"dy":1,"tileId":189,"passable":false,"blockZ":"under"}
 * ]>
 * <tileOffsets2:[
 *   {"dx":0,"dy":0,"tileId":181,"passable":true,"blockZ":"under"},
 *   {"dx":1,"dy":0,"tileId":182,"passable":true,"blockZ":"under"},
 *   {"dx":0,"dy":1,"tileId":213,"passable":true,"blockZ":"over"},
 *   {"dx":1,"dy":1,"tileId":214,"passable":true,"blockZ":"over"}
 * ]>
 * <growthTime:200>
 * <dropItems1:itemId:4,amount:1>
 * <dropItems2:itemId:4,amount:3>
 * 以上がメモ欄へ記載するメタタグ。
 * tileIdはタイルセットのcols（1行に何個タイルがあるか）に影響されます。
 * colsが16の場合、1行目はtileId:1で、2行目はtileId:17となります。
 * colsはプラグインパラメータで変更が可能です。
 * 
 * <tileOffsets1:>と<tileOffsets2:>は成長前と成長後に
 * どのマスにどのtileIdを表示するかの指定、
 * passableはtrueで通行可能、falseで通行不可能の指定が可能です。
 * blockZはunderでプレイヤーより下層、overでプレイヤーより上層に
 * 表示されるようになります。
 * 
 * growthTimeはブロックが成長するまでの時間で、
 * 0の場合は成長しない普通のブロックとなります。
 * dropItems1は成長前、dropItems2は成長後に
 * ブロックを破壊すると落とすアイテムを指定できます。
 * 各タイルセットのtileIdを知りたい場合は、別ファイルの
 * TileID計算ツール.htmlを使うと楽になるかもしれません。
 * 
 * ▼ ツール（武器）のメタタグ例（tool指定と破壊対象のtileId）
 * （今後、ブロック種別などの実装予定）
 * <tool>
 * <blockEffective:[1,2,3]>
 *
 * ▼ 使用例：スクリプトからブロックを設置・破壊
 * window.RSTH_IH.SurvivalBlockManager.place(x, y, itemId)
 * window.RSTH_IH.SurvivalBlockManager.break(x, y)
 * window.RSTH_IH.SurvivalBlockManager.get(x, y)
 *
 * ▼ ライセンス
 * このプラグインは MITライセンス の下で公開されています。
 * 
 * ----------------------------
 * 変更履歴:
 * ----------------------------
 * 
 * Ver.1.0.8 - 2025/06/03
 *     色々な機能を追加。
 *     RSTH_IH、RSTH_Survivalなどを統合し、ファイルを分割した。
 * 
 * Ver.1.0.7 - 2025/05/31
 *     RSTH_Survival.jsに合わせて内容を修正。
 * 
 * Ver.1.0.6 - 2025/05/29
 *     インベントリ、ホットバーのprocessTouch()関連の処理を修正。
 *     ブロック設置前の判定を強化。
 * 
 * Ver.1.0.5 - 2025/05/27
 *     インベントリ、ホットバーがメッセージウィンドウより下に表示されるように修正。
 * 
 * Ver.1.0.4 - 2025/05/27
 *   - アイテムを二重に使用するバグを修正。
 *     武器をダブルクリック、数字キー押下で装備できるように修正
 *     武器を装備するシステム自体をありにするか、なしにするかを
 *     プラグインパラメータで設定できるように修正
 * 
 * Ver.1.0.3 - 2025/05/27
 *   - インベントリ満杯、ホットバーに空きスロットが1つ、 他スロットに防具2が存在し、
 *     防具1を装備している状態で、防具2があるスロットに対応する数字キーを押下後、
 *     防具2が装備されるが、外された防具1がホットバーに格納されないバグを修正。
 *     RSTH_DEBUG_LOG がtrueの場合のみこのファイルのコンソールログを出力するように修正
 * 
 * Ver.1.0.2 - 2025/05/26
 *   - インベントリとホットバーが満杯の時、メニューの装備から装備を外せないように修正
 * 
 * Ver.1.0.1 - 2025/05/26
 *   - 通常イベントのアイテム入手処理からインベントリ、ホットバーに格納できるように修正
 * 
 * Ver.1.0.0 - 2025/05/25
 *   - 初版公開
 * 
 * @param HotbarPosition
 * @text ホットバーの画面配置
 * @type select
 * @option topleft
 * @option top
 * @option topright
 * @option bottomleft
 * @option bottom
 * @option bottomright
 * @default bottomright
 * @desc ホットバーの画面上の位置を指定します。
 * 
 * @param HotbarSlotSize
 * @type number
 * @default 32
 *
 * @param HotbarPrevKey
 * @type string
 * @default [
 *
 * @param HotbarNextKey
 * @type string
 * @default ]
 *
 * @param InventoryCols
 * @type number
 * @default 10
 *
 * @param InventoryRows
 * @type number
 * @default 6
 *
 * @param InventorySlotSize
 * @type number
 * @default 32
 *
 * @param StackSize
 * @type number
 * @default 99
 *  
 * @param EnableWeaponEquip
 * @text 武器を装備可能にする
 * @type boolean
 * @default true
 * @desc ダブルクリックで武器を装備する機能をON/OFFできます。
 * 
 * @param TilesetConfigs
 * @text タイルセット設定
 * @type struct<TilesetConfig>[]
 * @default []
 * @desc タイルセットごとの tileSize や cols 設定
 * 
 * @param RSTH_EquipmentUI_SLOT_SIZE
 * @text スロットサイズ（px）
 * @type number
 * @default 32
 * @desc 各装備スロットの1マスのサイズ（ピクセル単位）

 * @param RSTH_EquipmentUI_EQUIP_INDICES
 * @text 装備スロット番号配列
 * @type number[]
 * @default ["1","2","3","4"]
 * @desc 対象とする装備スロットの番号配列（武器=0、盾=1、頭=2...）
 *
 * @param RSTH_EquipmentUI_Position
 * @text 装備ウィンドウの位置
 * @type select
 * @option topleft
 * @option topright
 * @option bottomleft
 * @option bottomright
 * @default bottomleft
 * @desc 装備ウィンドウを表示する画面の位置
 * @param RSTH_EquipmentUI_ToggleKey
 * @text 装備ウィンドウ開閉キー
 * @type string
 * @default e
 * @desc 装備ウィンドウの表示／非表示を切り替えるキー（小文字）
 */

/*~struct~TilesetConfig:
 * @param name
 * @text タイルセット名
 * @desc タイル画像ファイル名（拡張子不要）
 * 
 * @param tileSize
 * @text タイルサイズ
 * @type number
 * @default 48
 *
 * @param cols
 * @text 列数
 * @type number
 * @default 16
 * 
 */

(() => {
    "use strict";

    window.RSTH_IH = window.RSTH_IH || {};

    // ログ出力制御フラグ（trueでログ出力、falseで抑制）
    //const RSTH_DEBUG_LOG = true;
    const RSTH_DEBUG_LOG = false;

    window.RSTH_IH.parameters = PluginManager.parameters("RSTH_IH01_Core");


    window.RSTH_IH.StackSize = Number(window.RSTH_IH.parameters["StackSize"] || 99);

    //ホットバー関連の宣言
    window.RSTH_IH.HotbarSlotSize = Number(window.RSTH_IH.parameters["HotbarSlotSize"] || 32);
    window.RSTH_IH.HotbarPrevKey = window.RSTH_IH.parameters["HotbarPrevKey"] || "[";
    window.RSTH_IH.HotbarNextKey = window.RSTH_IH.parameters["HotbarNextKey"] || "]";
    window.RSTH_IH.HotbarSlotCount = 10;//10固定。変更しないこと
    window.RSTH_IH.Hotbarmargin = 8;
    window.RSTH_IH.Hotbarpadding = 12;
    window.RSTH_IH.HotbarcontentWidth = window.RSTH_IH.HotbarSlotCount * window.RSTH_IH.HotbarSlotSize + (window.RSTH_IH.HotbarSlotCount - 1) * window.RSTH_IH.Hotbarmargin;
    window.RSTH_IH.Hotbarwidth = window.RSTH_IH.HotbarcontentWidth + window.RSTH_IH.Hotbarpadding * 2 + window.RSTH_IH.Hotbarmargin;
    window.RSTH_IH.Hotbarheight = window.RSTH_IH.HotbarSlotSize + window.RSTH_IH.Hotbarpadding * 2 + window.RSTH_IH.Hotbarmargin;
    window.RSTH_IH.HotbarPosition = window.RSTH_IH.parameters["HotbarPosition"] || "bottomright";

    //インベントリ関連の宣言
    window.RSTH_IH.InventorySlotSize = Number(window.RSTH_IH.parameters["InventorySlotSize"] || 32);
    window.RSTH_IH.InventoryCols = Number(window.RSTH_IH.parameters["InventoryCols"] || 10);
    window.RSTH_IH.InventoryRows = Number(window.RSTH_IH.parameters["InventoryRows"] || 6);
    window.RSTH_IH.Inventorymargin = 8;
    window.RSTH_IH.Inventorypadding = 12;
    window.RSTH_IH.InventorycontentWidth = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventorySlotSize + (window.RSTH_IH.InventoryCols - 1) * window.RSTH_IH.Inventorymargin;
    window.RSTH_IH.InventorycontentHeight = window.RSTH_IH.InventoryRows * window.RSTH_IH.InventorySlotSize + (window.RSTH_IH.InventoryRows - 1) * window.RSTH_IH.Inventorymargin;
    window.RSTH_IH.Inventorywidth = window.RSTH_IH.InventorycontentWidth + window.RSTH_IH.Inventorypadding * 2 + window.RSTH_IH.Inventorymargin;
    window.RSTH_IH.Inventoryheight = window.RSTH_IH.InventorycontentHeight + window.RSTH_IH.Inventorypadding * 2 + window.RSTH_IH.Inventorymargin;

    window.RSTH_IH.EnableWeaponEquip = window.RSTH_IH.parameters["EnableWeaponEquip"] === "true";
    if (RSTH_DEBUG_LOG) console.log(`window.RSTH_IH.EnableWeaponEquip`, window.RSTH_IH.EnableWeaponEquip);


    window.RSTH_IH.__draggingItem = null;
    window.RSTH_IH.__draggingFrom = null;
    window.RSTH_IH.__draggingIndex = null;

    window.RSTH_IH.__popupOwner = null;

    window.RSTH_IH.__hotbarKeyListenerAdded = false;

    // ホットバーのカーソル位置保存用
    window.RSTH_IH.HobarSlotsIndex = 0;

    window.RSTH_IH.__needGrowthSpriteUpdate = false;

    window.RSTH_IH.TILESET_NAME = window.RSTH_IH.parameters["TilesetName"] || "Inside_C";

    window.RSTH_IH.tilesetConfigsRaw = window.RSTH_IH.parameters["TilesetConfigs"] || "[]";


    window.RSTH_IH.EQUIP_SLOT_SIZE = Number(window.RSTH_IH.parameters["RSTH_EquipmentUI_SLOT_SIZE"] || 32); // スロット1つのサイズ
    window.RSTH_IH.EQUIP_POSITION = window.RSTH_IH.parameters["RSTH_EquipmentUI_Position"] || "bottomleft";
    window.RSTH_IH.EQUIP_TOGGLE_KEY = (window.RSTH_IH.parameters["RSTH_EquipmentUI_ToggleKey"] || "e").toLowerCase();

    // 装備スロット配列の変換（string[] → number[]）
    window.RSTH_IH.EQUIP_INDICES = JSON.parse(window.RSTH_IH.parameters["RSTH_EquipmentUI_EQUIP_INDICES"] || "[1,2,3,4]").map(Number);

    window.RSTH_IH.Eqslotmargin = 8;

    // 初期化時に指定キーを仮想アクション "toggleEquipment" に割り当て
    Input.keyMapper = Input.keyMapper || {};
    Input.keyMapper[window.RSTH_IH.EQUIP_TOGGLE_KEY.toUpperCase().charCodeAt(0)] = "toggleEquipment";









})();











