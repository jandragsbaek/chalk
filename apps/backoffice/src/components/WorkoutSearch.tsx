import type * as React from "react";

import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

/** Remount with `key={query}` to reset the field when the URL changes (back/forward). */
export function WorkoutSearch({ query }: { readonly query: string }) {
  const navigate = useNavigate({ from: "/" });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    void navigate({ search: q === "" ? {} : { q } });
  }

  return (
    <form role="search" className="flex w-full max-w-sm gap-2" onSubmit={handleSubmit}>
      <Input
        name="q"
        type="search"
        defaultValue={query}
        placeholder="Name, score or notes"
        aria-label="Search workouts"
      />
      <Button type="submit" variant="outline" aria-label="Search">
        <Search />
      </Button>
    </form>
  );
}
