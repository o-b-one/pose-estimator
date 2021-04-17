import { EBodyParts } from "../constants/body-parts.enum";

export interface IPoseEstimationResult{
    score: number,
     position: {
         x: number,
         y: number
    },
    part: keyof typeof EBodyParts
}