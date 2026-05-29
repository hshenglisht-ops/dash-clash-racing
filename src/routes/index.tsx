import { createFileRoute, Link } from "@tanstack/react-router";
import { MASCOT_ORDER, CHARACTERS } from "@/lib/characters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DASH & CLASH — 영어 퀴즈 레이싱 게임" },
      {
        name: "description",
        content:
          "중학교 영어 수업용 팀 대항 퀴즈 레이싱 보드게임. 버저를 누르고 베팅하고 캐릭터를 결승선으로!",
      },
      { property: "og:title", content: "DASH & CLASH" },
      {
        property: "og:description",
        content: "영어 퀴즈로 펼치는 팀 대항 레이싱 보드게임",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-chili/20 blur-[120px]" />
        <div className="absolute -right-24 top-40 h-96 w-96 rounded-full bg-frosty/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-boomba/20 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <p className="font-display text-2xl tracking-widest text-primary md:text-3xl">
          ENGLISH QUIZ RACE
        </p>
        <h1 className="font-display text-7xl leading-none text-stroke-dark md:text-9xl">
          <span className="text-chili">DASH</span>{" "}
          <span className="text-zapper">&</span>{" "}
          <span className="text-frosty">CLASH</span>
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground md:text-lg">
          퀴즈를 맞히고, 베팅하고, 캐릭터를 결승선까지 — 팀 대항 레이싱 보드게임
        </p>

        {/* characters */}
        <div className="mt-10 flex flex-wrap items-end justify-center gap-2 md:gap-6">
          {MASCOT_ORDER.map((name, i) => {
            const c = CHARACTERS[name];
            return (
              <div
                key={name}
                className="flex flex-col items-center animate-bob"
                style={{ animationDelay: `${i * 0.25}s` }}
              >
                <img
                  src={c.image}
                  alt={c.name}
                  className="h-24 w-24 object-contain drop-shadow-2xl md:h-32 md:w-32"
                />
                <span
                  className="font-display text-lg tracking-wide md:text-xl"
                  style={{ color: c.color }}
                >
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="mt-12 flex w-full max-w-md flex-col gap-4 sm:flex-row">
          <Link
            to="/host"
            className="group flex-1 rounded-2xl border-2 border-primary bg-primary px-6 py-5 font-display text-2xl tracking-wide text-primary-foreground shadow-[0_8px_0_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 active:translate-y-0.5"
          >
            새 게임 만들기
          </Link>
          <Link
            to="/join"
            className="flex-1 rounded-2xl border-2 border-frosty bg-card px-6 py-5 font-display text-2xl tracking-wide text-frosty shadow-[0_8px_0_0_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-1 active:translate-y-0.5"
          >
            게임 참가하기
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          교사는 <span className="text-primary">[새 게임 만들기]</span>, 학생 조는{" "}
          <span className="text-frosty">[게임 참가하기]</span>
        </p>
      </div>
    </div>
  );
}
