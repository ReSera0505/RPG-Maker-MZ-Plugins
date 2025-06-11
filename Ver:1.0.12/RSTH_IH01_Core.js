/*:
 * @target MZ
 * @plugindesc RSTH_IH: サバイバルゲームシステムプラグイン ver1.0.12
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
RSTH_IH01_Core.js
RSTH_IH02_Util_01.js
RSTH_IH02_Util_02.js
RSTH_IH02_Util_03.js
RSTH_IH02_Util_04.js
RSTH_IH02_Util_05_Gain.js
RSTH_IH02_Util_06_Handle.js
RSTH_IH03_Window_01.js
RSTH_IH03_Window_02.js
RSTH_IH04_UseItem.js
RSTH_IH05_dropitem.js
RSTH_IH06_Block_01_Main.js
RSTH_IH06_Block_02_Auto.js
RSTH_IH06_Block_03_grow.js
RSTH_IH10_SaveLoad.js
RSTH_IH11_Debug.js
RSTH_IH12_EventHelper.js
 * 
 * マップ画面で "E" キーを押すとインベントリと装備ウィンドウが開閉します。
 * 
 * ブロックを設置するアイテムのメモ欄には以下のようなメタタグを設定してください：
 *
 * ▼ ブロックアイテムのメタタグ例（通常アイテムとして作成）
<block>
<tileId:60>
<blockName:木>
<blockType:plant>
<blockHP:9>
<autoTile:false>
<tileType:0>
<size:[1,2]>
<tileset:Tl_Outside_B>
<tileOffsets1:[
{"dx":0,"dy":0,"tileId":1,"passable":true,"blockZ":"under"},
{"dx":0,"dy":1,"tileId":60,"passable":false,"blockZ":"under"}
]>
<tileOffsets2:[
{"dx":0,"dy":0,"tileId":76,"passable":true,"blockZ":"over"},
{"dx":0,"dy":1,"tileId":92,"passable":false,"blockZ":"under"}
]>
<growthTime:200>
<dropItems1:itemId:52,amount:1>
<dropItems2:itemId:52,amount:3>
 * 
 * 以上がメモ欄へ記載するメタタグ。
 * tileIdはタイルセットのcols（1行に何個タイルがあるか）に影響されます。
 * colsが16の場合、1行目はtileId:1で、2行目はtileId:17となります。
 * colsはプラグインパラメータで変更が可能です。
 * 
 * blockTypeでブロックの種類を指定します。
 * 重ね置きはgroundが最下層でその上にfloor、その上にplant、furniture、wallが
 * 置けるようになります。
 * 現在このブロックの種別は固定で今後変更可能になるかもしれません。
 * また、成長するブロックはblockTypeをplantに指定してください。
 * 
 * sizeはsize:[1,2]とあれば横1、縦2となります。
 * 
 * <tileOffsets1:>と<tileOffsets2:>は成長前と成長後に
 * どのマスにどのtileIdを表示するかの指定、
 * passableはtrueで通行可能、falseで通行不可能の指定が可能です。
 * blockZは基本的に、underでプレイヤーより下層、overでプレイヤーより上層に
 * 表示されるようになります。
 * ブロックの重ね置きは各blockType別にこのunderのsprite.zを変化させることにより
 * 表示順を制御しています。
 * 
 * growthTimeはブロックが成長するまでの時間で、
 * 0の場合は成長しない普通のブロックとなります。
 * dropItems1は成長前、dropItems2は成長後に
 * ブロックを破壊すると落とすアイテムを指定できます。
 * 各タイルセットのtileIdを知りたい場合は、別ファイルの
 * TileID計算ツール.htmlを使うと楽になるかもしれません。
 * 
 * autoTileはtrueにするとオートタイルのブロックを設置します。
 * tileTypeが0の場合はfloorタイプ、つまりInside_A2のようにA2のタイルセットや
 * Inside_A4のwallタイプの屋根部分（横2、縦3のタイル群を1パターンとする）を扱う
 * オートタイルに対応しており、
 * tileTypeが1の場合はInside_A4のwallタイプの本体部分
 * （屋根部分の下の横2、縦2のタイル群を1パターンとする）
 * を扱うオートタイルに対応しています。
 * オートタイルに使用するタイルセットはMZ標準のA2、A4に合わせて作成してください。
 * 現状扱えるのは1行に16列のタイルセット。8列には未対応。
 * タイルのアニメーションにはまだ未対応。
 * 
 * ブロックのタイプをchestにするとそのブロックは収納ができるチェストになります。
<blockType:chest>
<chestsize:[10,6]>
 * 上のタグを設定すると横10縦6のサイズでアイテム類の収納ができるチェストとなります。
 * 中身の入っているチェストブロックを破壊するとその中身がすべてドロップします。
 * 
 * ブロックのタイプをworkbenchにするとそのブロックはアイテム作成ができる作業台になります。
 * アイテム作成に使うレシピは、プレイヤーキャラクターが覚えているスキルの
 * メモ欄の以下のようなメタタグで設定します。
<itemId:7>
<resultCount:1>
<ingredients:[
  {"id": 150, "count": 1},
  {"id": 151, "count": 1}
]>
 * itemIdは作成するアイテムのid、resultCountは一度に作成する個数、
 * ingredientsは材料にするアイテムのidとその数を指定します。
 * アイテムを作成するにはこういうメタタグがあるスキルを習得する必要があります。
 * 今のところアイテムが作れるだけです。武具については今後他で実装予定。
 * 
 * ▼ ツール（武器）のメタタグ例
 * （tool指定とブロックへの攻撃力と破壊対象のブロック種別）
 * 
<tool>
<toolPower:3>
<blockEffective:["furniture","wall","floor"]>
 * 
 * 
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
 * Ver.1.0.12 - 2025/06/011
 *     オートタイルの実装方法をMZ風に変更。
 *     ファイルを並び替えたりした。
 * 
 * Ver.1.0.11 - 2025/06/09
 *     チェストブロックを追加。
 *     作業台ブロックを追加。
 * 
 * Ver.1.0.10 - 2025/06/07
 *     ブロックにHP、toolにブロックへの攻撃力を追加。
 *     マップに設置されるブロックに対して軽量化処理を追加。
 *     チャンクの概念を追加。
 *     成長するブロックはプレイヤーの周囲に存在していないときは成長を止める。
 *     ブロックにオートタイルの概念を追加。
 * 
 * Ver.1.0.9 - 2025/06/05
 *     インベントリ、ホットバーからの装備処理を修正。
 *     ブロックに重ね置きの概念を追加した。
 *     ドロップアイテムをスタック可能にした。
 *     ドロップアイテムを拾うときに吸い込む動作を追加した。
 *     インベントリ、ホットバーからアイテムをマップ上にD&Dできるようにした。
 *     toolの破壊可能なブロックの指定をブロックの種類に変更した。
 *     ブロックを設置できるアイテムをホットバーで選択している場合、
 *     マップ画面上でそのブロックのゴーストを表示可能とした。
 *     
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
 * @type select
 * @option topleft
 * @option top
 * @option topright
 * @option bottomleft
 * @option bottom
 * @option bottomright
 * @default bottomright
 * @desc ホットバーとインベントリの画面上の位置を指定します。
 * 
 * @param HotbarSlotSize
 * @type number
 * @default 32
 * @desc ホットバースロットの1マスのサイズ（ピクセル単位）
 *
 * @param HotbarPrevKey
 * @type string
 * @default [
 * @desc ホットバーで前のスロットを選択するキー
 *
 * @param HotbarNextKey
 * @type string
 * @default ]
 * @desc ホットバーで次のスロットを選択するキー
 *
 * @param InventoryCols
 * @type number
 * @default 10
 * @desc インベントリの1行のスロット数
 *
 * @param InventoryRows
 * @type number
 * @default 6
 * @desc インベントリの最大行数
 *
 * @param InventorySlotSize
 * @type number
 * @default 32
 * @desc インベントリスロットの1マスのサイズ（ピクセル単位）
 *
 * @param StackSize
 * @type number
 * @default 99
 * @desc 各スロットに格納できる最大数
 * 
 * @param pickupRange
 * @type number
 * @default 3
 * @desc ドロップアイテムを回収できる最大距離
 * 
 * @param growBlock
 * @type string
 * @default plant
 * @desc 成長できるブロックタイプ
 * 
 * @param EnableWeaponEquip
 * @type boolean
 * @default true
 * @desc ダブルクリックで武器を装備する機能をON/OFFできます。
 * 
 * @param EquipmentUI_SLOT_SIZE
 * @type number
 * @default 32
 * @desc 装備スロットの1マスのサイズ（ピクセル単位）

 * @param EquipmentUI_EQUIP_INDICES
 * @type number[]
 * @default ["1","2","3","4"]
 * @desc 対象とする装備スロットの番号配列（武器=0、盾=1、頭=2...）
 *
 * @param EquipmentUI_Position
 * @type select
 * @option topleft
 * @option topright
 * @option bottomleft
 * @option bottomright
 * @default bottomleft
 * @desc 装備ウィンドウを表示する画面の位置
 * 
 * @param EquipmentUI_ToggleKey
 * @type string
 * @default e
 * @desc 装備ウィンドウの表示／非表示を切り替えるキー（小文字）
 * 
 * @param TilesetConfigs
 * @type struct<TilesetConfig>[]
 * @default []
 * @desc タイルセットごとの tileSize や cols 設定
 * 
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

  window.RSTH_IH.__rsth_shouldRunOnMapLoaded = true; // メニュー開閉後判定用

  const filename = document.currentScript.src.match(/([^\/]+)\.js$/)[1];  //拡張子なしのファイル名を参照
  window.RSTH_IH.parameters = PluginManager.parameters(filename);


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

  window.RSTH_IH.InventorycontentWidth = window.RSTH_IH.InventoryCols * window.RSTH_IH.InventorySlotSize + (window.RSTH_IH.InventoryCols) * window.RSTH_IH.Inventorymargin;
  window.RSTH_IH.InventorycontentHeight = window.RSTH_IH.InventoryRows * window.RSTH_IH.InventorySlotSize + (window.RSTH_IH.InventoryRows) * window.RSTH_IH.Inventorymargin;

  window.RSTH_IH.Inventorywidth = window.RSTH_IH.InventorycontentWidth + window.RSTH_IH.Inventorypadding * 2;
  window.RSTH_IH.Inventoryheight = window.RSTH_IH.InventorycontentHeight + window.RSTH_IH.Inventorypadding * 2;

  window.RSTH_IH.EnableWeaponEquip = window.RSTH_IH.parameters["EnableWeaponEquip"] === "true";


  window.RSTH_IH.PickUpRange = Number(window.RSTH_IH.parameters["pickupRange"] || 3);

  window.RSTH_IH.GrowBlock = window.RSTH_IH.parameters["growBlock"] || "plant";
  if (RSTH_DEBUG_LOG) console.warn("window.RSTH_IH.GrowBlock", window.RSTH_IH.GrowBlock);

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
  if (RSTH_DEBUG_LOG) console.warn("tilesetConfigsRaw", window.RSTH_IH.tilesetConfigsRaw);


  window.RSTH_IH.EQUIP_SLOT_SIZE = Number(window.RSTH_IH.parameters["EquipmentUI_SLOT_SIZE"] || 32); // スロット1つのサイズ
  window.RSTH_IH.EQUIP_POSITION = window.RSTH_IH.parameters["EquipmentUI_Position"] || "bottomleft";
  window.RSTH_IH.EQUIP_TOGGLE_KEY = (window.RSTH_IH.parameters["EquipmentUI_ToggleKey"] || "e").toLowerCase();

  // 装備スロット配列の変換（string[] → number[]）
  window.RSTH_IH.EQUIP_INDICES = JSON.parse(window.RSTH_IH.parameters["EquipmentUI_EQUIP_INDICES"] || "[1,2,3,4]").map(Number);

  window.RSTH_IH.Eqslotmargin = 8;

  // 初期化時に指定キーを仮想アクション "toggleEquipment" に割り当て
  Input.keyMapper = Input.keyMapper || {};
  Input.keyMapper[window.RSTH_IH.EQUIP_TOGGLE_KEY.toUpperCase().charCodeAt(0)] = "toggleEquipment";

  window.RSTH_IH.FloorAutotileBitmaskToShape = new Map([
    [0, 46],
    [1, 45],
    [2, 46],
    [3, 45],
    [4, 42],
    [5, 37],
    [6, 42],
    [7, 36],
    [8, 46],
    [9, 45],
    [10, 46],
    [11, 45],
    [12, 42],
    [13, 37],
    [14, 42],
    [15, 36],
    [16, 43],
    [17, 33],
    [18, 43],
    [19, 33],
    [20, 35],
    [21, 23],
    [22, 35],
    [23, 21],
    [24, 43],
    [25, 33],
    [26, 43],
    [27, 33],
    [28, 34],
    [29, 22],
    [30, 34],
    [31, 20],
    [32, 46],
    [33, 45],
    [34, 46],
    [35, 45],
    [36, 42],
    [37, 37],
    [38, 42],
    [39, 36],
    [40, 46],
    [41, 45],
    [42, 46],
    [43, 45],
    [44, 42],
    [45, 37],
    [46, 42],
    [47, 36],
    [48, 43],
    [49, 33],
    [50, 43],
    [51, 33],
    [52, 35],
    [53, 23],
    [54, 35],
    [55, 21],
    [56, 43],
    [57, 33],
    [58, 43],
    [59, 33],
    [60, 34],
    [61, 22],
    [62, 34],
    [63, 20],
    [64, 44],
    [65, 39],
    [66, 44],
    [67, 39],
    [68, 32],
    [69, 27],
    [70, 32],
    [71, 26],
    [72, 44],
    [73, 39],
    [74, 44],
    [75, 39],
    [76, 32],
    [77, 27],
    [78, 32],
    [79, 26],
    [80, 41],
    [81, 31],
    [82, 41],
    [83, 31],
    [84, 19],
    [85, 15],
    [86, 19],
    [87, 7],
    [88, 41],
    [89, 31],
    [90, 41],
    [91, 31],
    [92, 17],
    [93, 11],
    [94, 17],
    [95, 3],
    [96, 44],
    [97, 39],
    [98, 44],
    [99, 39],
    [100, 32],
    [101, 27],
    [102, 32],
    [103, 26],
    [104, 44],
    [105, 39],
    [106, 44],
    [107, 39],
    [108, 32],
    [109, 27],
    [110, 32],
    [111, 26],
    [112, 40],
    [113, 29],
    [114, 40],
    [115, 29],
    [116, 18],
    [117, 13],
    [118, 18],
    [119, 5],
    [120, 40],
    [121, 29],
    [122, 40],
    [123, 29],
    [124, 16],
    [125, 9],
    [126, 16],
    [127, 1],
    [128, 46],
    [129, 45],
    [130, 46],
    [131, 45],
    [132, 42],
    [133, 37],
    [134, 42],
    [135, 36],
    [136, 46],
    [137, 45],
    [138, 46],
    [139, 45],
    [140, 42],
    [141, 37],
    [142, 42],
    [143, 36],
    [144, 43],
    [145, 33],
    [146, 43],
    [147, 33],
    [148, 35],
    [149, 23],
    [150, 35],
    [151, 21],
    [152, 43],
    [153, 33],
    [154, 43],
    [155, 33],
    [156, 34],
    [157, 22],
    [158, 34],
    [159, 20],
    [160, 46],
    [161, 45],
    [162, 46],
    [163, 45],
    [164, 42],
    [165, 37],
    [166, 42],
    [167, 36],
    [168, 46],
    [169, 45],
    [170, 46],
    [171, 45],
    [172, 42],
    [173, 37],
    [174, 42],
    [175, 36],
    [176, 43],
    [177, 33],
    [178, 43],
    [179, 33],
    [180, 35],
    [181, 23],
    [182, 35],
    [183, 21],
    [184, 43],
    [185, 33],
    [186, 43],
    [187, 33],
    [188, 34],
    [189, 22],
    [190, 34],
    [191, 20],
    [192, 44],
    [193, 38],
    [194, 44],
    [195, 38],
    [196, 32],
    [197, 25],
    [198, 32],
    [199, 24],
    [200, 44],
    [201, 38],
    [202, 44],
    [203, 38],
    [204, 32],
    [205, 25],
    [206, 32],
    [207, 24],
    [208, 41],
    [209, 30],
    [210, 41],
    [211, 30],
    [212, 19],
    [213, 14],
    [214, 19],
    [215, 6],
    [216, 41],
    [217, 30],
    [218, 41],
    [219, 30],
    [220, 17],
    [221, 10],
    [222, 17],
    [223, 2],
    [224, 44],
    [225, 38],
    [226, 44],
    [227, 38],
    [228, 32],
    [229, 25],
    [230, 32],
    [231, 24],
    [232, 44],
    [233, 38],
    [234, 44],
    [235, 38],
    [236, 32],
    [237, 25],
    [238, 32],
    [239, 24],
    [240, 40],
    [241, 28],
    [242, 40],
    [243, 28],
    [244, 18],
    [245, 12],
    [246, 18],
    [247, 4],
    [248, 40],
    [249, 28],
    [250, 40],
    [251, 28],
    [252, 16],
    [253, 8],
    [254, 16],
    [255, 0]
  ]);

  window.RSTH_IH.WallAutotileBitmaskToShape = new Map([
    [0, 15],  // 単体15
    [1, 14],
    [2, 15],
    [3, 15],
    [4, 7],
    [5, 7],
    [6, 7],
    [7, 6],
    [8, 15],
    [9, 14],
    [10, 15],
    [11, 15],
    [12, 7],
    [13, 7],
    [14, 7],
    [15, 6],
    [16, 11],
    [17, 10],
    [18, 11],
    [19, 10],
    [20, 7],
    [21, 7],
    [22, 7],
    [23, 6],
    [24, 15],
    [25, 14],
    [26, 15],
    [27, 15],
    [28, 3],
    [29, 3],
    [30, 3],
    [31, 2],
    [32, 15],
    [33, 14],
    [34, 15],
    [35, 15],
    [36, 7],
    [37, 7],
    [38, 7],
    [39, 6],
    [40, 15],
    [41, 14],
    [42, 15],
    [43, 15],
    [44, 7],
    [45, 7],
    [46, 7],
    [47, 6],
    [48, 15],
    [49, 14],
    [50, 15],
    [51, 15],
    [52, 7],
    [53, 7],
    [54, 7],
    [55, 6],
    [56, 15],
    [57, 14],
    [58, 15],
    [59, 15],
    [60, 7],
    [61, 7],
    [62, 7],
    [63, 6],
    [64, 13],
    [65, 13],
    [66, 13],
    [67, 13],
    [68, 5],
    [69, 5],
    [70, 5],
    [71, 5],
    [72, 13],
    [73, 13],
    [74, 13],
    [75, 13],
    [76, 5],
    [77, 5],
    [78, 5],
    [79, 5],
    [80, 13],
    [81, 13],
    [82, 13],
    [83, 13],
    [84, 5],
    [85, 5],
    [86, 5],
    [87, 5],
    [88, 13],
    [89, 13],
    [90, 13],
    [91, 13],
    [92, 5],
    [93, 5],
    [94, 5],
    [95, 5],
    [96, 13],
    [97, 13],
    [98, 13],
    [99, 13],
    [100, 5],
    [101, 5],
    [102, 5],
    [103, 5],
    [104, 13],
    [105, 13],
    [106, 13],
    [107, 13],
    [108, 5],
    [109, 5],
    [110, 5],
    [111, 5],
    [112, 9],
    [113, 9],
    [114, 9],
    [115, 9],
    [116, 5],
    [117, 5],
    [118, 5],
    [119, 5],
    [120, 13],
    [121, 13],
    [122, 13],
    [123, 13],
    [124, 1],
    [125, 1],
    [126, 1],
    [127, 1],
    [128, 15],
    [129, 14],
    [130, 15],
    [131, 14],
    [132, 7],
    [133, 7],
    [134, 7],
    [135, 7],
    [136, 15],
    [137, 15],
    [138, 15],
    [139, 15],
    [140, 7],
    [141, 7],
    [142, 7],
    [143, 7],
    [144, 11],
    [145, 11],
    [146, 11],
    [147, 11],
    [148, 7],
    [149, 7],
    [150, 7],
    [151, 7],
    [152, 11],
    [153, 15],
    [154, 15],
    [155, 15],
    [156, 3],
    [157, 3],
    [158, 3],
    [159, 3],
    [160, 15],
    [161, 15],
    [162, 15],
    [163, 15],
    [164, 7],
    [165, 7],
    [166, 7],
    [167, 7],
    [168, 15],
    [169, 15],
    [170, 15],
    [171, 15],
    [172, 7],
    [173, 7],
    [174, 7],
    [175, 7],
    [176, 15],
    [177, 15],
    [178, 15],
    [179, 15],
    [180, 7],
    [181, 7],
    [182, 7],
    [183, 7],
    [184, 15],
    [185, 15],
    [186, 15],
    [187, 15],
    [188, 7],
    [189, 7],
    [190, 7],
    [191, 7],
    [192, 13],
    [193, 12],
    [194, 13],
    [195, 13],
    [196, 5],
    [197, 5],
    [198, 5],
    [199, 4],
    [200, 13],
    [201, 4],
    [202, 13],
    [203, 13],
    [204, 5],
    [205, 5],
    [206, 5],
    [207, 4],
    [208, 13],
    [209, 12],
    [210, 13],
    [211, 13],
    [212, 5],
    [213, 5],
    [214, 5],
    [215, 4],
    [216, 13],
    [217, 12],
    [218, 13],
    [219, 13],
    [220, 5],
    [221, 5],
    [222, 5],
    [223, 4],
    [224, 13],
    [225, 12],
    [226, 13],
    [227, 13],
    [228, 5],
    [229, 5],
    [230, 5],
    [231, 4],
    [232, 13],
    [233, 12],
    [234, 13],
    [235, 13],
    [236, 5],
    [237, 5],
    [238, 5],
    [239, 4],
    [240, 9],
    [241, 8],
    [242, 9],
    [243, 9],
    [244, 5],
    [245, 5],
    [246, 5],
    [247, 4],
    [248, 13],
    [249, 12],
    [250, 13],
    [251, 13],
    [252, 1],
    [253, 1],
    [254, 1],
    [255, 0]

  ]);



})();











