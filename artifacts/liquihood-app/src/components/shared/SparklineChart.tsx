import React from 'react';
import {
  LineChart, Line, ResponsiveContainer, YAxis, XAxis,
  Tooltip, ReferenceLine,
} from 'recharts';

interface Props {
  data: { day: number; hf: number }[];
  color?: string;
}

export function SparklineChart({ data, color = '#D0EF19' }: Props) {
  return (
    <div className="h-[100px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 32 }}>
          <YAxis
            domain={[0, 2.5]}
            ticks={[0, 1.3, 2]}
            tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(2)}
            width={28}
          />
          <XAxis
            dataKey="day"
            ticks={[0, 15, 30]}
            tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v === 0 ? '30d ago' : v === 15 ? '15d ago' : 'Today'
            }
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', fontFamily: 'JetBrains Mono', fontSize: 11 }}
            itemStyle={{ color }}
            formatter={(v: number) => [v > 99 ? '∞' : v.toFixed(2), 'HF']}
            labelFormatter={() => ''}
          />
          <ReferenceLine y={1.3} stroke="#FFB224" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine y={1.0} stroke="#FF4D4D" strokeDasharray="3 3" strokeWidth={1} />
          <Line type="monotone" dataKey="hf" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
