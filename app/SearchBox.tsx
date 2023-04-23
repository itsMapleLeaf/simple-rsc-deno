"use client"
import { useTransition } from "react"

export default function SearchBox(props: { search: string }) {
  const [isPending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    startTransition(() => {
      window.router.navigate(`?search=${e.target.value}`)
    })
  }
  return (
    <>
      <input
        className="border-2 border-slate-500"
        type="text"
        defaultValue={props.search}
        onChange={onChange}
      />
      <span
        className={[
          "ml-2 transition-opacity delay-100 duration-75",
          isPending ? "opacity-100" : "opacity-0",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <i>Loading...</i>
      </span>
    </>
  )
}
