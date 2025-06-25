// app/api/pin/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const pinata = new FormData()
    pinata.append("file", file, file.name)
    pinata.append(
      "pinataMetadata",
      JSON.stringify({ name: file.name, keyvalues: { app: "Moonexpress" } })
    )

    const res = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: pinata,
      }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error("Pinata error:", text)
      throw new Error("Pinata upload failed")
    }

    const { IpfsHash } = await res.json()
    return NextResponse.json({ cid: IpfsHash })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json(
      { error: e.message || "Unexpected error" },
      { status: 500 }
    )
  }
}