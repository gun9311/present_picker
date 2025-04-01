from .slot_machine import apply_slot_machine_effect
from .roulette import apply_roulette_effect
# from .scanner_zoom import apply_scanner_zoom_effect
# from .race import apply_race_effect
# from .handpick import apply_handpick_effect
# from .curtain import apply_curtain_call_effect

# 애니메이션 모듈 매핑 추가
ANIMATION_MODULES = {
    'slot': apply_slot_machine_effect,
    'roulette': apply_roulette_effect,
    # 'scanner': apply_scanner_zoom_effect,
    # 'race': apply_race_effect,
    # 'handpick': apply_handpick_effect,
    # 'curtain': apply_curtain_call_effect
}

__all__ = [
    'apply_slot_machine_effect',
    'apply_roulette_effect',
    # 'apply_curtain_call_effect',
    # 'apply_scanner_zoom_effect',
    # 'apply_race_effect',
    # 'apply_handpick_effect',
    'ANIMATION_MODULES'  # ANIMATION_MODULES도 export
]
