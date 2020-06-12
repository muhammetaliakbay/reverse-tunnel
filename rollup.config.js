import typescript from 'rollup-plugin-typescript2' // '@rollup/plugin-typescript'
import scss from 'rollup-plugin-scss'
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

export default [
    {
        input: [
            './src/index.tsx',
        ],
        output: {
            dir: 'bundle',
            format: 'cjs',
            sourcemap: 'inline'
        },
        external: [
            'electron'
        ],
        plugins: [
            nodeResolve(),
            commonjs(),
            scss({
                output: './bundle/index.css'
            }),
            typescript(),
        ],
    },
    {
        input: [
            './src/main.ts'
        ],
        output: {
            dir: 'bundle',
            format: 'cjs',
            sourcemap: 'inline'
        },
        external: [
            'electron'
        ],
        plugins: [
            nodeResolve(),
            commonjs(),
            typescript(),
        ],
    },
    {
        input: [
            './src/console/console-main.ts'
        ],
        output: {
            dir: 'bundle',
            format: 'cjs',
            sourcemap: 'inline'
        },
        plugins: [
            nodeResolve(),
            commonjs(),
            typescript(),
        ],
    }
];
