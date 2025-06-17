import { useMemo } from "react";

export default function TradesTable() {
  // Sample data with address and transaction hash
  const rows = useMemo(() => [
    {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      type: "Buy",
      bnb: "1.2345",
      fbd: "2,400",
      date: "3:33:19 PM",
      txHash: "0xabcdef1234567890abcdef1234567890abcdef12",
    },
    {
      address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      type: "Sell",
      bnb: "0.8765",
      fbd: "1,600",
      date: "3:31:45 PM",
      txHash: "0x1234567890abcdef1234567890abcdef12345678",
    },
    {
      address: "0xfeedfacecafebeefdeadbeefcafebabefeedface",
      type: "Buy",
      bnb: "3.5000",
      fbd: "7,000",
      date: "3:29:12 PM",
      txHash: "0xbeefcafe1234567890deadbeefcafebabedeadbe",
    },
    {
      address: "0xdeadc0debeefcafe1234567890abcdef12345678",
      type: "Buy",
      bnb: "0.5000",
      fbd: "1,000",
      date: "3:27:33 PM",
      txHash: "0xfeedfacecafebeefdeadbeefcafebabefeedface",
    },
    {
      address: "0xba5eba11deadbeefcafebabefeedfacecafedead",
      type: "Sell",
      bnb: "2.0000",
      fbd: "4,000",
      date: "3:25:10 PM",
      txHash: "0xdeadc0debeefcafe1234567890abcdef12345678",
    },
    {
      address: "0xabad1deaabad1deaabad1deaabad1deaabad1dea",
      type: "Buy",
      bnb: "1.1111",
      fbd: "2,222",
      date: "3:22:09 PM",
      txHash: "0xba5eba11deadbeefcafebabefeedfacecafedead",
    },
    {
      address: "0xfeedface000000001234567890abcdefabcdef00",
      type: "Sell",
      bnb: "0.3333",
      fbd: "666",
      date: "3:20:45 PM",
      txHash: "0xabad1deaabad1deaabad1deaabad1deaabad1dea",
    },
  ], []);

  // Helper to truncate long strings
  const truncate = (str, start = 6, end = 4) =>
    `${str.slice(0, start)}...${str.slice(-end)}`;

  return (
    <div className="w-full overflow-x-auto">
      <div className="theme-textarea max-h-64 overflow-y-auto">
        <table className="w-full min-w-full table-fixed">
          <thead className="sticky top-0 bg-[#132043] z-10">
            <tr className="border-b border-[#21325e]">
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Wallet
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Type
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                BNB
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                $FBD
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Date
              </th>
              <th className="text-left text-[#c8cdd1] text-sm font-medium py-3 px-4">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.txHash} className="border-b border-[#21325e]/50">
                <td className="py-3 px-4">
                  <span className="text-white text-sm">
                    {truncate(row.address)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-sm font-medium ${
                      row.type === "Buy" ? "text-green-500" : "text-[#ff6b6b]"
                    }`}
                  >
                    {row.type}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-white text-sm">
                    {parseFloat(row.bnb).toFixed(4)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-white text-sm">{row.fbd}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[#c8cdd1] text-sm">{row.date}</span>
                </td>
                <td className="py-3 px-4">
                  <a
                    href={`https://bscscan.com/tx/${row.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#19c0f4] underline"
                  >
                    {truncate(row.txHash)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}