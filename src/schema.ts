import { z } from "zod"

export const dwellTimeSchema = z.array(
  z.object({
    Date: z.string(),
    Week: z.number(),
    Month: z.number(),
    Year: z.number(),
    Railroad: z.enum(["CN", "NS", "UP", "CP", "BNSF", "KCS", "CSX"]),
    Yard: z.string(),
    Location: z.string(),
    Latitude: z.number(),
    Longitude: z.number(),
    Value: z.number()
  })
)

export const statesJsonSchema = z.object({
  type: z.string(),
  features: z.array(
    z.union([
      z.object({
        type: z.string(),
        id: z.string(),
        properties: z.object({ name: z.string(), density: z.number() }),
        geometry: z.object({
          type: z.string(),
          coordinates: z.array(z.array(z.array(z.number())))
        })
      }),
      z.object({
        type: z.string(),
        id: z.string(),
        properties: z.object({ name: z.string(), density: z.number() }),
        geometry: z.object({
          type: z.string(),
          coordinates: z.array(z.array(z.array(z.array(z.number()))))
        })
      })
    ])
  )
})
