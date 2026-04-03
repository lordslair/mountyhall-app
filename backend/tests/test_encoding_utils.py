from encoding_utils import deep_fix_mojibake_utf8, fix_mojibake_utf8


def test_fix_mojibake_utf8_raistlin_style_name():
    # UTF-8 for "é" misread as Latin-1 → two chars U+00C3 + U+00A9 (shown as "BlÃ©ro")
    mojibake = 'Bl' + '\xc3\xa9' + 'ro *le Retour*'
    assert fix_mojibake_utf8(mojibake) == 'Bléro *le Retour*'


def test_fix_mojibake_utf8_already_correct_unchanged():
    assert fix_mojibake_utf8('Bléro *le Retour*') == 'Bléro *le Retour*'


def test_fix_mojibake_utf8_ascii_unchanged():
    assert fix_mojibake_utf8('plain') == 'plain'


def test_deep_fix_mojibake_utf8_nested():
    mojibake = 'Bl' + '\xc3\xa9' + 'ro *le Retour*'
    data = {'trolls': [{'nom': mojibake, 'id': 1}]}
    out = deep_fix_mojibake_utf8(data)
    assert out['trolls'][0]['nom'] == 'Bléro *le Retour*'
    assert out['trolls'][0]['id'] == 1
