import { z } from 'zod'

export const Point2Schema = z.tuple([z.number(), z.number()])
export const Point3Schema = z.tuple([z.number(), z.number(), z.number()])

export type PoolPoint = z.infer<typeof Point2Schema>
export type PoolPosition = z.infer<typeof Point3Schema>
