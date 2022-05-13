export const unitFileConfig = {
  config: {
    servername: "default",
    adminPW: "PasswordXYZ",
    cachedir: `/mnt/default`
  }
}

export const sandboxFileConfig = {
  config: {
    zombies: 4,
    distribution: 1,
    water_shut: 4,
    elec_shut: 4,
    water_mod: 30,
    elec_mod: 30,
    food_loot: 3,
    canned_loot: 3,
    lit_loot: 4,
    survival_loot: 2,
    medical_loot: 2,
    weapon_loot: 3,
    ranged_loot: 3,
    ammo_loot: 3,
    mechanic_loot: 2,
    other_loot: 4,
    erosion_speed: 3,
    erosion_days: 0,
    xp_mult: 2.0,
    loot_respawn: 4,
    heli: 3,
    meta_event: 2,
    ch_points: 5,
    // fire_spread: false, // TODO::Undertand bools in this context
    zed_speed: 2,
    zed_strength: 3,
    zed_touch: 2,
    zed_transmission: 1,
    zed_mortality: 4,
    zed_reanimate: 3,
    zed_cognition: 2,
    zed_crawl: 4,
    zed_memory: 3,
    zed_decomp: 3,
    zed_sight: 2,
    zed_hearing: 2,
    zed_active: 2,
    zed_pop_mult: 1.0,
    zed_start_mult: 1.0,
    zed_peak_mult: 2.5,
    zed_peak_day: 40,
    zed_spawn_mult: 0.1
  }
};
