#!/usr/bin/env python3
"""30秒版×2部の MulmoScript を生成する。

  第1部 課題編   docs/video/promo-60s-A.json  自治体・JA向け・60秒。docs/問題提起A4.pdf の映像版
  第2部 散布者編 docs/video/promo-30s-B.json  慣行農家・ドローン散布者向け。実画面中心

使い方（リポジトリ直下で）:
  python3 docs/video/build-promo-30s.py
  mulmo movie docs/video/promo-60s-A.json -o assets/video/out -f
  mulmo movie docs/video/promo-30s-B.json -o assets/video/out -f

構成・文言・作り方の正本は docs/video/README.md。通常は docs/video/render.sh から呼ぶ。
ナレーションなし・全ビート文字なし（TTS を呼ばせない）。音楽は後から audioParams.bgm で足す。
素材パスは「この台本ファイルの場所」基準で解決される（-b ではない）。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "docs/video"
A = "../../assets/video/"  # 台本ファイルから見た素材フォルダ

W, H = 1920, 1080
FPS = 30

FONT = '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">'

STYLE = f"""
<style>
  html,body{{margin:0;padding:0;width:{W}px;height:{H}px;overflow:hidden;background:#0b1410}}
  .stage{{position:relative;width:{W}px;height:{H}px;overflow:hidden;background:#0b1410;
         font-family:'Noto Sans JP',system-ui,sans-serif;color:#f4f1e8}}
  .abs{{position:absolute}}
  .fill{{left:0;top:0;width:{W}px;height:{H}px}}
  .cover{{width:100%;height:100%;object-fit:cover;display:block}}
  .shade{{background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(5,12,8,.78) 100%)}}
  .shade2{{background:linear-gradient(180deg,rgba(0,0,0,0) 28%,rgba(5,12,8,.88) 100%)}}
  .cap{{font-weight:900;font-size:66px;letter-spacing:.02em;line-height:1.25;
       text-shadow:0 2px 28px rgba(0,0,0,.5);white-space:nowrap}}
  .cap2{{font-weight:900;font-size:50px;letter-spacing:.02em;line-height:1.3;
        text-shadow:0 2px 28px rgba(0,0,0,.5);white-space:nowrap}}
  .sub{{font-weight:500;font-size:28px;line-height:1.5;opacity:.92;text-shadow:0 1px 14px rgba(0,0,0,.5)}}
  .bar{{height:7px;background:#7ed957;border-radius:4px}}
  .kick{{font-weight:700;font-size:26px;letter-spacing:.18em;color:#9fe88a}}
  .frame{{border-radius:20px;overflow:hidden;box-shadow:0 36px 90px rgba(0,0,0,.6);
         border:1px solid rgba(255,255,255,.10);background:#111}}
  .flash{{background:#ffffff}}
  .pinlabel{{font-weight:700;font-size:30px;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.7)}}
</style>
"""


def beat(bid, duration, html, script):
    return {
        "id": bid,
        "duration": duration,
        "image": {
            "type": "html_tailwind",
            "html": [FONT, STYLE, html],
            "script": [script],
            "animation": {"fps": FPS},
        },
    }


def caption_block(text, sub=None, kicker=None, left=120, bottom=120, cls="cap", line2=None):
    sub_html = f'<div id="sub" class="sub" style="margin-top:18px;opacity:0">{sub}</div>' if sub else ""
    kick_html = f'<div id="kick" class="kick" style="margin-bottom:14px;opacity:0">{kicker}</div>' if kicker else ""
    l2 = f'<div id="cap2" class="{cls}" style="opacity:0;margin-top:6px">{line2}</div>' if line2 else ""
    return f"""
<div class="abs" style="left:{left}px;bottom:{bottom}px">
  {kick_html}
  <div id="cap" class="{cls}" style="opacity:0">{text}</div>
  {l2}
  <div id="bar" class="bar" style="width:0px;margin-top:16px"></div>
  {sub_html}
</div>"""


def caption_anim(start, has_sub=False, has_kick=False, has_line2=False):
    s = []
    if has_kick:
        s.append(f'animation.animate("#kick", {{opacity:[0,1], translateX:[-20,0]}}, {{start:{start:.2f}, end:{start+0.4:.2f}, easing:"easeOut"}});')
    s.append(f'animation.animate("#cap", {{opacity:[0,1], translateY:[36,0]}}, {{start:{start+0.1:.2f}, end:{start+0.7:.2f}, easing:"easeOut"}});')
    t = start + 0.5
    if has_line2:
        s.append(f'animation.animate("#cap2", {{opacity:[0,1], translateY:[30,0]}}, {{start:{start+0.6:.2f}, end:{start+1.2:.2f}, easing:"easeOut"}});')
        t = start + 1.1
    s.append(f'animation.animate("#bar", {{width:[0,240,"px"]}}, {{start:{t:.2f}, end:{t+0.5:.2f}, easing:"easeOut"}});')
    if has_sub:
        s.append(f'animation.animate("#sub", {{opacity:[0,1], translateY:[16,0]}}, {{start:{t+0.4:.2f}, end:{t+0.9:.2f}, easing:"easeOut"}});')
    return "\n".join(s)


def screen_beat(bid, duration, movie_key, text, sub=None, kicker=None, flash=False):
    """実画面のビート。1920x1080 の録画を角丸の枠に入れ、わずかに寄せる。"""
    fw, fh = 1600, 900
    fx, fy = (W - fw) // 2, 70
    flash_html = '<div id="flash" class="abs fill flash" style="opacity:0"></div>' if flash else ""
    html = f"""
<div class="stage">
  <div id="frame" class="abs frame" style="left:{fx}px;top:{fy}px;width:{fw}px;height:{fh}px;transform-origin:50% 40%">
    <video id="v" class="cover" src="movie:{movie_key}" muted playsinline preload="auto"></video>
  </div>
  <div class="abs fill shade" style="pointer-events:none"></div>
  {caption_block(text, sub, kicker)}
  {flash_html}
</div>"""
    script = f"""
var animation = new MulmoAnimation();
animation.animate("#frame", {{scale:[1.05,1.0], opacity:[0.0,1.0]}}, {{start:0, end:1.1, easing:"easeOut"}});
{caption_anim(0.5, has_sub=bool(sub), has_kick=bool(kicker))}
"""
    if flash:
        script += 'animation.animate("#flash", {opacity:[1,0]}, {start:0, end:0.55, easing:"easeOut"});\n'
    return beat(bid, duration, html, script)


def picture_beat(bid, duration, img_key, text, sub=None, kicker=None, cross_to=None, cross_at=None,
                 cap_start=None, zoom=(1.0, 1.07), extra_html="", extra_script="", cls="cap", line2=None):
    """イラストのビート。ゆっくり寄り、必要なら途中で別の絵へ溶暗する。"""
    cross_html = (f'<div id="b" class="abs fill" style="opacity:0;transform-origin:50% 60%"><img class="cover" src="image:{cross_to}"></div>'
                  if cross_to else "")
    html = f"""
<div class="stage">
  <div id="a" class="abs fill" style="transform-origin:55% 45%"><img class="cover" src="image:{img_key}"></div>
  {cross_html}
  {extra_html}
  <div class="abs fill shade2"></div>
  <div class="abs fill" style="background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.5) 100%)"></div>
  {caption_block(text, sub, kicker, cls=cls, line2=line2)}
</div>"""
    cs = cap_start if cap_start is not None else 0.8
    script = f"""
var animation = new MulmoAnimation();
animation.animate("#a", {{scale:[{zoom[0]},{zoom[1]}]}}, {{start:0, end:{duration}, easing:"linear"}});
"""
    if cross_to:
        script += f'animation.animate("#b", {{opacity:[0,1], scale:[1.10,1.0]}}, {{start:{cross_at}, end:{cross_at+0.7}, easing:"easeOut"}});\n'
    script += caption_anim(cs, has_sub=bool(sub), has_kick=bool(kicker), has_line2=bool(line2)) + "\n" + extra_script
    return beat(bid, duration, html, script)


# ---------- 第1部 課題編（自治体・JA向け・60秒） ----------
# docs/問題提起A4.pdf の映像版。節1〜4を順に追い、製品は最後の数秒だけ（2026-10-01 門田さん決定）。
# 文言は資料の本文を画面用に短くしたもの。新しい主張を足さない。


def pins(items, t0=0.6, step=0.8):
    """俯瞰図の上に灯すピン。items = [(ラベル, x比, y比)]"""
    svg = [f'<svg class="abs fill" viewBox="0 0 {W} {H}" style="pointer-events:none">']
    lbl, sc = [], ""
    for i, (label, fx, fy) in enumerate(items):
        x, y = int(fx * W), int(fy * H)
        svg.append(f'<circle id="ring{i}" cx="{x}" cy="{y}" r="10" fill="none" stroke="#9fe88a" stroke-width="4" opacity="0"/>')
        svg.append(f'<circle id="dot{i}" cx="{x}" cy="{y}" r="11" fill="#9fe88a" stroke="#0b1410" stroke-width="4" opacity="0"/>')
        lbl.append(f'<div id="lbl{i}" class="abs pinlabel" style="left:{x+22}px;top:{y-22}px;opacity:0">{label}</div>')
        t = t0 + i * step
        sc += f'animation.animate("#dot{i}", {{opacity:[0,1]}}, {{start:{t:.2f}, end:{t+0.3:.2f}}});\n'
        sc += f'animation.animate("#lbl{i}", {{opacity:[0,1], translateX:[-12,0]}}, {{start:{t+0.15:.2f}, end:{t+0.5:.2f}, easing:"easeOut"}});\n'
        sc += f'animation.animate("#ring{i}", {{r:[10,140], opacity:[0.9,0]}}, {{start:{t:.2f}, end:{t+1.6:.2f}, easing:"easeOut"}});\n'
    svg.append("</svg>")
    return "\n".join(svg + lbl), sc


# 節1: 統計がない（文字だけの場面）
stat_rows = ["農薬事故統計", "公害苦情調査", "都道府県への空中散布計画書"]
stat_html = f"""
<div class="stage">
  <div class="abs fill" style="background:radial-gradient(ellipse at 50% 35%, #16271d 0%, #0b1410 70%)"></div>
  <div class="abs" style="left:160px;top:120px;right:160px">
    <div id="kick" class="kick" style="opacity:0">分かっていること、分かっていないこと</div>
    <div id="h" class="cap2" style="margin-top:16px;opacity:0">事前の周知は、どれだけ行われているのか。</div>
    <div style="margin-top:56px">
      {''.join(f'<div id="row{i}" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.18);padding:22px 8px;opacity:0"><span style="font-size:36px;font-weight:700">{r}</span><span style="font-size:30px;opacity:.75">「周知を行った割合」の集計　<b style="font-size:44px;color:#f0b35a;margin-left:14px">なし</b></span></div>' for i, r in enumerate(stat_rows))}
    </div>
    <div id="big" class="cap" style="margin-top:64px;opacity:0">測る仕組みが、そもそもない。</div>
    <div id="bar" class="bar" style="width:0px;margin-top:16px"></div>
    <div id="sub" class="sub" style="margin-top:18px;opacity:0">特定の自治体の取り組みが不足している、という話ではありません。</div>
  </div>
</div>"""
stat_script = """
var animation = new MulmoAnimation();
animation.animate("#kick", {opacity:[0,1]}, {start:0.2, end:0.6});
animation.animate("#h", {opacity:[0,1], translateY:[24,0]}, {start:0.4, end:1.0, easing:"easeOut"});
animation.animate("#row0", {opacity:[0,1], translateX:[-24,0]}, {start:1.6, end:2.0, easing:"easeOut"});
animation.animate("#row1", {opacity:[0,1], translateX:[-24,0]}, {start:2.3, end:2.7, easing:"easeOut"});
animation.animate("#row2", {opacity:[0,1], translateX:[-24,0]}, {start:3.0, end:3.4, easing:"easeOut"});
animation.animate("#big", {opacity:[0,1], translateY:[30,0]}, {start:4.4, end:5.1, easing:"easeOut"});
animation.animate("#bar", {width:[0,240,"px"]}, {start:5.0, end:5.5, easing:"easeOut"});
animation.animate("#sub", {opacity:[0,1]}, {start:5.8, end:6.4, easing:"easeOut"});
"""

# 節2: ガイドライン（俯瞰にピン＋4点）
g_pins_html, g_pins_script = pins(
    [("有機のほ場", 0.20, 0.55), ("学校", 0.875, 0.375), ("家屋", 0.585, 0.49), ("蜜蜂の巣箱", 0.36, 0.33)], t0=0.6, step=0.7)
chips = ["① 散布の日時", "② 使用目的", "③ 使用農薬の種類", "④ 実施主体の連絡先"]
chips_html = '<div style="display:flex;gap:18px;margin-top:22px">' + "".join(
    f'<div id="chip{i}" style="opacity:0;font-size:30px;font-weight:700;padding:10px 22px;border-radius:999px;background:rgba(159,232,138,.16);border:2px solid #9fe88a">{c}</div>'
    for i, c in enumerate(chips)) + "</div>"
guide_html = f"""
<div class="stage">
  <div id="a" class="abs fill" style="transform-origin:55% 45%"><img class="cover" src="image:cut05"></div>
  {g_pins_html}
  <div class="abs fill shade2"></div>
  <div class="abs" style="left:120px;bottom:90px">
    <div id="kick" class="kick" style="margin-bottom:14px;opacity:0">国のガイドラインが求めていること</div>
    <div id="cap" class="cap2" style="opacity:0">周辺に配慮すべき対象があるとき、事前に知らせる。</div>
    {chips_html}
    <div id="bar" class="bar" style="width:0px;margin-top:22px"></div>
    <div id="sub" class="sub" style="margin-top:16px;opacity:0">天候などで日時が変わったら、その変更を改めて知らせる。</div>
  </div>
</div>"""
guide_script = """
var animation = new MulmoAnimation();
animation.animate("#a", {scale:[1.0,1.08]}, {start:0, end:10, easing:"linear"});
""" + g_pins_script + """
animation.animate("#kick", {opacity:[0,1], translateX:[-20,0]}, {start:3.4, end:3.8, easing:"easeOut"});
animation.animate("#cap", {opacity:[0,1], translateY:[30,0]}, {start:3.6, end:4.2, easing:"easeOut"});
""" + "".join(
    f'animation.animate("#chip{i}", {{opacity:[0,1], translateY:[14,0]}}, {{start:{4.6+i*0.45:.2f}, end:{5.0+i*0.45:.2f}, easing:"easeOut"}});\n'
    for i in range(4)) + """
animation.animate("#bar", {width:[0,240,"px"]}, {start:6.6, end:7.1, easing:"easeOut"});
animation.animate("#sub", {opacity:[0,1], translateY:[14,0]}, {start:7.2, end:7.8, easing:"easeOut"});
"""

# 締め: 文字が先、最後の数秒だけ実画面とサービス名
close_A_html = """
<div class="stage">
  <div class="abs fill" style="background:radial-gradient(ellipse at 40% 40%, #16271d 0%, #0b1410 70%)"></div>
  <div class="abs" style="left:140px;top:250px;width:1000px">
    <div id="l0" class="kick" style="opacity:0">新たな規制や負担ではなく</div>
    <div id="l1" class="cap" style="font-size:62px;margin-top:18px;opacity:0;white-space:normal">周知と記録は、散布する人を<br>縛るものではなく、守るもの。</div>
    <div id="bar" class="bar" style="width:0px;margin-top:26px"></div>
    <div id="l2" class="sub" style="font-size:32px;margin-top:26px;opacity:0">まず現状を把握し、解決策の検討につなげたい。</div>
    <div id="l3" style="margin-top:70px;opacity:0">
      <div style="font-weight:700;font-size:40px;letter-spacing:.06em">となりの畑セーフティ<span style="font-weight:500;font-size:28px;opacity:.8">（仮称）</span></div>
      <div class="sub" style="margin-top:12px">作っている途中です。実情を聞かせてください。</div>
    </div>
  </div>
  <div id="frame" class="abs frame" style="left:1200px;top:330px;width:600px;height:338px;opacity:0">
    <video class="cover" src="movie:map" muted playsinline preload="auto"></video>
  </div>
</div>"""
close_A_script = """
var animation = new MulmoAnimation();
animation.animate("#l0", {opacity:[0,1]}, {start:0.2, end:0.7, easing:"easeOut"});
animation.animate("#l1", {opacity:[0,1], translateY:[30,0]}, {start:0.6, end:1.4, easing:"easeOut"});
animation.animate("#bar", {width:[0,200,"px"]}, {start:1.4, end:1.9, easing:"easeOut"});
animation.animate("#l2", {opacity:[0,1], translateY:[14,0]}, {start:2.4, end:3.0, easing:"easeOut"});
animation.animate("#frame", {opacity:[0,1], scale:[1.06,1.0]}, {start:5.4, end:6.2, easing:"easeOut"});
animation.animate("#l3", {opacity:[0,1], translateY:[14,0]}, {start:5.8, end:6.5, easing:"easeOut"});
"""

beats_A = [
    picture_beat("a-title", 6.0, "cut01", "ドローンによる農薬散布の、", line2="事前周知をめぐる課題",
                 sub="国のガイドラインが求めていることと、現場で実行できていないこと", cap_start=1.2, zoom=(1.0, 1.06)),
    beat("a-stat", 8.0, stat_html, stat_script),
    beat("a-guide", 10.0, guide_html, guide_script),
    picture_beat("a-m1", 5.0, "cut04", "周辺に誰がいるかを、知る手段がない。", kicker="実行する手段がない ①",
                 sub="隣のほ場が有機なのか、蜜蜂の巣箱がどこにあるのか。", cap_start=0.5, zoom=(1.0, 1.06)),
    picture_beat("a-m2", 5.0, "cut12", "変わったことを、伝え直す手段がない。", kicker="実行する手段がない ②",
                 sub="回覧や機関紙では、同じ相手へその都度伝え直すことができません。", cross_to="cut13", cross_at=2.2,
                 cap_start=0.5, zoom=(1.0, 1.05)),
    picture_beat("a-m3", 4.0, "cut14", "届いたかを、確かめる手段がない。", kicker="実行する手段がない ③",
                 sub="受け取る側も、自分に関係する散布かどうかを判断しにくい。", cap_start=0.4, zoom=(1.0, 1.05)),
    picture_beat("a-r1", 6.0, "cut03", "残留が確認されたとき、散布した人の手元に", kicker="記録が残らないこと",
                 line2="いつ・どこで・どんな条件で散布したかの記録がない。", sub="疑いを向けられた側が、自分の作業を説明する材料を持っていません。",
                 cap_start=0.5, zoom=(1.0, 1.06), cls="cap2"),
    picture_beat("a-r2", 6.0, "cut16", "有機農家にとって、隣からの飛散は経営のリスク。",
                 line2="記録が残らないことが、双方を等しく不利にしている。", sub="どちらかに責任がある、という話ではありません。",
                 cap_start=0.5, zoom=(1.0, 1.06), cls="cap2"),
    beat("a-close", 10.0, close_A_html, close_A_script),
]

# ---------- 第2部 散布者編（慣行農家・ドローン散布者向け） ----------

open_B_html = f"""
<div class="stage">
  <div id="a" class="abs fill" style="transform-origin:55% 45%"><img class="cover" src="image:cut02"></div>
  <div id="b" class="abs fill" style="opacity:0;transform-origin:50% 60%"><img class="cover" src="image:cut04"></div>
  <div class="abs fill shade"></div>
  <div id="vig" class="abs fill" style="background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)"></div>
  {caption_block("まく前に、知らせる。", kicker="散布の前に")}
</div>"""
open_B_script = f"""
var animation = new MulmoAnimation();
animation.animate("#a", {{scale:[1.0,1.08]}}, {{start:0, end:3.2, easing:"linear"}});
animation.animate("#b", {{opacity:[0,1], scale:[1.10,1.0]}}, {{start:2.6, end:3.3, easing:"easeOut"}});
{caption_anim(3.2, has_kick=True)}
"""

close_B_html = """
<div class="stage">
  <div class="abs fill" style="background:radial-gradient(ellipse at 50% 40%, #16271d 0%, #0b1410 70%)"></div>
  <div class="abs" style="left:0;right:0;top:360px;text-align:center">
    <div id="l1" class="cap" style="font-size:72px;opacity:0">まく前に知らせて、飛散トラブルを防ぐ。</div>
    <div id="bar" class="bar" style="width:0px;margin:34px auto 0"></div>
    <div id="l2" style="font-weight:700;font-size:44px;letter-spacing:.06em;margin-top:40px;opacity:0">となりの畑セーフティ<span style="font-weight:500;font-size:30px;opacity:.8">（仮称）</span></div>
  </div>
</div>"""
close_B_script = """
var animation = new MulmoAnimation();
animation.animate("#l1", {opacity:[0,1], translateY:[30,0]}, {start:0.2, end:0.9, easing:"easeOut"});
animation.animate("#bar", {width:[0,160,"px"]}, {start:0.8, end:1.3, easing:"easeOut"});
animation.animate("#l2", {opacity:[0,1], translateY:[16,0]}, {start:1.3, end:1.9, easing:"easeOut"});
"""

beats_B = [
    beat("open", 5.0, open_B_html, open_B_script),
    screen_beat("map", 5.5, "map", "知らせる相手が、地図の上に出る。", kicker="圃場マップ・周辺確認", flash=True),
    screen_beat("notify", 4.5, "notify", "地区へのお知らせは、投稿ひとつ。",
                sub="有機のほ場など、特に配慮が要る相手へは、個別にご連絡ください。", kicker="近隣通知"),
    screen_beat("weather", 3.5, "weather", "当日の風も、決められた確認も、記録しながら。", kicker="気象メモ・散布前チェック"),
    screen_beat("postpone", 4.5, "postpone", "延期になったら、同じ相手にもう一度。", kicker="延期のお知らせ"),
    screen_beat("history", 3.0, "history", "まいた記録も、同じ案件に。", kicker="ドローン連携・作業履歴"),
    beat("close", 4.0, close_B_html, close_B_script),
]

IMAGES = {
    "cut01": {"type": "image", "source": {"kind": "path", "path": A + "cut01-dawn-paddies-v1.png"}},
    "cut02": {"type": "image", "source": {"kind": "path", "path": A + "cut02-kei-truck-drone-v1.png"}},
    "cut05": {"type": "image", "source": {"kind": "path", "path": A + "cut05-oblique-farmland-v1.png"}},
    "cut04": {"type": "image", "source": {"kind": "path", "path": A + "cut04-farmer-drone-v1.png"}},
    "cut03": {"type": "image", "source": {"kind": "path", "path": A + "cut03-pouring-liquid-v1.png"}},
    "cut13": {"type": "image", "source": {"kind": "path", "path": A + "cut13-after-rain-a.png"}},
    "cut14": {"type": "image", "source": {"kind": "path", "path": A + "cut14-school-a.png"}},
    "cut16": {"type": "image", "source": {"kind": "path", "path": A + "cut16-organic-field-a.png"}},
    "cut08": {"type": "image", "source": {"kind": "path", "path": A + "cut08-smartphone-transition-v1.png"}},
    "cut12": {"type": "image", "source": {"kind": "path", "path": A + "cut12-overcast-a.png"}},
    "cut17": {"type": "image", "source": {"kind": "path", "path": A + "cut17-phone-post-a.png"}},
    "map": {"type": "movie", "source": {"kind": "path", "path": A + "out/clips/map.mp4"}},
    "notify": {"type": "movie", "source": {"kind": "path", "path": A + "out/clips/notify.mp4"}},
    "weather": {"type": "movie", "source": {"kind": "path", "path": A + "out/clips/weather.mp4"}},
    "postpone": {"type": "movie", "source": {"kind": "path", "path": A + "out/clips/postpone.mp4"}},
    "history": {"type": "movie", "source": {"kind": "path", "path": A + "out/clips/history.mp4"}},
}


def write(name, title, beats):
    script = {
        "$mulmocast": {"version": "1.1"},
        "title": title,
        "lang": "ja",
        "canvasSize": {"width": W, "height": H},
        "imageParams": {"images": IMAGES},
        "beats": beats,
    }
    out = HERE / name
    out.write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}  beats={len(beats)}  total={sum(b['duration'] for b in beats):.1f}s")


write("promo-60s-A.json", "ドローンによる農薬散布の事前周知をめぐる課題（第1部・自治体/JA向け・60秒）", beats_A)
write("promo-30s-B.json", "となりの畑セーフティ 第2部 散布者編（慣行農家・ドローン散布者向け）", beats_B)
