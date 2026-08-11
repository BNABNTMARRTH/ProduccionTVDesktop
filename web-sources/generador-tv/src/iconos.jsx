// Mapa de ICONOS por rol del equipo (nombre guardado en el proyecto → icono de
// lucide-react). Vive aparte porque lo usan tanto la rejilla de personal como
// el editor; el nombre ("director", "audio"…) es el dato que viaja en el .ptv,
// el icono es solo su representación visual.
import {
  Headphones, SlidersHorizontal, Volume2, Monitor,
  Play, Mic, Clapperboard, Lightbulb,
  Users, Pencil, User,
} from "lucide-react";

export const ICONS = {
  director: Headphones, switcher: SlidersHorizontal, audio: Volume2, graficos: Monitor,
  playback: Play, conductor: Mic, floor: Clapperboard, luces: Lightbulb,
  productor: Users, script: Pencil, custom: User,
};
