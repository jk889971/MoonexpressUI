// app/api/pin/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    // 1) grab the File that the browser sent
    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 2) build Pinata form-data using the File directly
    const pinata = new FormData()
    pinata.append("file", file, file.name) // File is a Blob, includes name
    pinata.append(
      "pinataMetadata",
      JSON.stringify({ name: file.name, keyvalues: { app: "Moonexpress" } })
    )

    // 3) send to Pinata; fetch and FormData are globals in Next.js API routes
    const res = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`, 
          // no need for Content-Type / boundary; next/runtime will set it
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