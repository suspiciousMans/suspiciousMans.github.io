// Sprites, icons and type colours, all from Pokémon Showdown's sprite server.
import { Sprites, Icons } from "@pkmn/img";

export const SPRITE_STYLES = [
    { value: "gen5ani", label: "Pixel" },
    { value: "ani", label: "3D" },
];

export function sprite(species, { style = "gen5ani", back = false, shiny = false } = {}) {
    // Newer Pokémon without an animated sprite fall back to still ones.
    return Sprites.getPokemon(species || "", { gen: style, side: back ? "p1" : "p2", shiny });
}

export function icon(species) {
    return Icons.getPokemon(species || "").css;
}

export function itemIcon(item) {
    return Icons.getItem(item || "").css;
}

export const TYPE_COLORS = {
    Normal: "#a8a77a",
    Fire: "#ee8130",
    Water: "#6390f0",
    Electric: "#f7d02c",
    Grass: "#7ac74c",
    Ice: "#96d9d6",
    Fighting: "#c22e28",
    Poison: "#a33ea1",
    Ground: "#e2bf65",
    Flying: "#a98ff3",
    Psychic: "#f95587",
    Bug: "#a6b91a",
    Rock: "#b6a136",
    Ghost: "#735797",
    Dragon: "#6f35fc",
    Dark: "#705746",
    Steel: "#b7b7ce",
    Fairy: "#d685ad",
    Stellar: "#40b5a5",
    "???": "#68a090",
};

export const STATUS_LABEL = { brn: "BRN", par: "PAR", psn: "PSN", tox: "TOX", slp: "SLP", frz: "FRZ" };

export const STAT_LABEL = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe", accuracy: "Acc", evasion: "Eva" };
