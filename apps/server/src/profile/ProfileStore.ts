import {
  AthleteBody,
  Bodyweight,
  BodyweightEntry,
  BodyweightNotFoundError,
  EMPTY_ATHLETE_PROFILE,
  type AthleteProfile,
  type IsoDate,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class ProfilePersistenceError extends Schema.TaggedError<ProfilePersistenceError>()(
  "ProfilePersistenceError",
  {
    operation: Schema.Literals([
      "load the profile",
      "save the profile",
      "log bodyweight",
      "delete bodyweight",
      "import scale weigh-ins",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

/** One day's scale reading: the day, kilograms and the local "HH:MM" it was taken. */
export interface ScaleReading extends BodyweightEntry {
  readonly measuredAt: string | null;
}

export class ProfileStore extends Context.Service<
  ProfileStore,
  {
    /** Sex, height, limbs and every weigh-in (oldest first); defaults before the first save. */
    readonly get: () => Effect.Effect<AthleteProfile, ProfilePersistenceError>;
    readonly update: (body: AthleteBody) => Effect.Effect<AthleteProfile, ProfilePersistenceError>;
    /** The day's weigh-in; a day logged again keeps only the new reading. */
    readonly logBodyweight: (
      entry: BodyweightEntry,
    ) => Effect.Effect<BodyweightEntry, ProfilePersistenceError>;
    readonly removeBodyweight: (
      performedOn: IsoDate,
    ) => Effect.Effect<void, BodyweightNotFoundError | ProfilePersistenceError>;
    /**
     * The scale's first reading of each day, from Garmin. A day the athlete typed keeps its
     * weigh-in; a day already read from the scale takes the new reading.
     */
    readonly importScaleReadings: (
      readings: ReadonlyArray<ScaleReading>,
    ) => Effect.Effect<void, ProfilePersistenceError>;
    /** How many days' bodyweight came from the scale. */
    readonly scaleWeighIns: () => Effect.Effect<number, ProfilePersistenceError>;
  }
>()("chalk/profile/ProfileStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const selectBody = SqlSchema.findAll({
    Request: Schema.Void,
    Result: AthleteBody,
    execute: () => sql`
      SELECT sex, height_cm AS "heightCm", arm_length_cm AS "armLengthCm",
             leg_length_cm AS "legLengthCm"
      FROM athlete_profile
      WHERE id = 1
    `,
  });

  const selectBodyweights = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Bodyweight,
    execute: () => sql`
      SELECT performed_on AS "performedOn", kg, source, measured_at AS "measuredAt"
      FROM bodyweights
      ORDER BY performed_on
    `,
  });

  const read = Effect.fn("ProfileStore.read")(function* () {
    const [body] = yield* selectBody(undefined);
    const bodyweights = yield* selectBodyweights(undefined);
    return { ...EMPTY_ATHLETE_PROFILE, ...body, bodyweights } satisfies AthleteProfile;
  });

  const get = Effect.fn("ProfileStore.get")(
    function* () {
      return yield* read();
    },
    Effect.mapError(
      (cause) => new ProfilePersistenceError({ operation: "load the profile", cause }),
    ),
  );

  const update = Effect.fn("ProfileStore.update")(
    function* (body: AthleteBody) {
      const now = DateTime.formatIso(yield* DateTime.now);
      yield* sql`
        INSERT INTO athlete_profile (id, sex, height_cm, arm_length_cm, leg_length_cm, updated_at)
        VALUES (1, ${body.sex}, ${body.heightCm}, ${body.armLengthCm}, ${body.legLengthCm}, ${now})
        ON CONFLICT (id) DO UPDATE SET
          sex = excluded.sex,
          height_cm = excluded.height_cm,
          arm_length_cm = excluded.arm_length_cm,
          leg_length_cm = excluded.leg_length_cm,
          updated_at = excluded.updated_at
      `;
      return yield* read();
    },
    Effect.mapError(
      (cause) => new ProfilePersistenceError({ operation: "save the profile", cause }),
    ),
  );

  const logBodyweight = Effect.fn("ProfileStore.logBodyweight")(
    function* (entry: BodyweightEntry) {
      const now = DateTime.formatIso(yield* DateTime.now);
      yield* sql`
        INSERT INTO bodyweights (performed_on, kg, source, measured_at, created_at)
        VALUES (${entry.performedOn}, ${entry.kg}, 'manual', NULL, ${now})
        ON CONFLICT (performed_on) DO UPDATE SET
          kg = excluded.kg,
          source = 'manual',
          measured_at = NULL,
          created_at = excluded.created_at
      `;
      return entry;
    },
    Effect.mapError((cause) => new ProfilePersistenceError({ operation: "log bodyweight", cause })),
  );

  const removeBodyweight = Effect.fn("ProfileStore.removeBodyweight")(function* (
    performedOn: IsoDate,
  ) {
    const deleted = yield* sql<{
      performed_on: string;
    }>`DELETE FROM bodyweights WHERE performed_on = ${performedOn} RETURNING performed_on`.pipe(
      Effect.mapError(
        (cause) => new ProfilePersistenceError({ operation: "delete bodyweight", cause }),
      ),
    );
    if (deleted.length === 0) return yield* new BodyweightNotFoundError({ performedOn });
  });

  const importScaleReadings = Effect.fn("ProfileStore.importScaleReadings")(
    function* (readings: ReadonlyArray<ScaleReading>) {
      if (readings.length === 0) return;
      const now = DateTime.formatIso(yield* DateTime.now);
      yield* sql.withTransaction(
        Effect.forEach(
          readings,
          (reading) => sql`
            INSERT INTO bodyweights (performed_on, kg, source, measured_at, created_at)
            VALUES (${reading.performedOn}, ${reading.kg}, 'garmin', ${reading.measuredAt}, ${now})
            ON CONFLICT (performed_on) DO UPDATE SET
              kg = excluded.kg,
              measured_at = excluded.measured_at,
              created_at = excluded.created_at
            WHERE bodyweights.source = 'garmin'
          `,
          { discard: true },
        ),
      );
    },
    Effect.mapError(
      (cause) => new ProfilePersistenceError({ operation: "import scale weigh-ins", cause }),
    ),
  );

  const scaleWeighIns = Effect.fn("ProfileStore.scaleWeighIns")(
    function* () {
      const [row] = yield* sql<{
        readonly count: number;
      }>`SELECT COUNT(*) AS count FROM bodyweights WHERE source = 'garmin'`;
      return row?.count ?? 0;
    },
    Effect.mapError(
      (cause) => new ProfilePersistenceError({ operation: "load the profile", cause }),
    ),
  );

  return ProfileStore.of({
    get,
    update,
    logBodyweight,
    removeBodyweight,
    importScaleReadings,
    scaleWeighIns,
  });
});

export const layer = Layer.effect(ProfileStore, make);
