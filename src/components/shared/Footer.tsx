import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Clock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 mt-auto text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="inline-flex w-fit rounded-lg bg-white p-2">
              <Image src="/images/brand/jk-copycenter-horizontal.webp" alt="JK Copycenter" width={960} height={462} className="h-10 w-auto" />
            </div>
            <p className="text-sm text-slate-400 max-w-md">
              Sua gráfica expressa e papelaria de confiança em Passos - MG. Impressões de alta definição, encadernações, plastificações, cópias e suprimentos com rapidez e excelência.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a
                href="https://instagram.com/jkcopycenter"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-pink-600 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                title="Instagram @jkcopycenter"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://www.facebook.com/JKCopyCenter/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                title="Facebook JK Copy Center"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://share.google/3jStxc1OYvpfH5rJ2"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-green-600 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                title="Google Maps"
              >
                <MapPin className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white tracking-wider uppercase">Navegação</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/grafica" className="text-sm text-slate-400 hover:text-white transition-colors">Gráfica & Serviços</Link>
              </li>
              <li>
                <Link href="/papelaria" className="text-sm text-slate-400 hover:text-white transition-colors">Papelaria</Link>
              </li>
              <li>
                <Link href="/sobre" className="text-sm text-slate-400 hover:text-white transition-colors">Sobre a JK</Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Área do Cliente</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white tracking-wider uppercase">Contato & Loja</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <a
                  href="https://share.google/3jStxc1OYvpfH5rJ2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Av. Jk, 270 - Jardim Colégio de Passos<br />Passos - MG, 37901-000
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <a
                  href="https://wa.me/5535991066260"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors font-medium text-slate-300"
                >
                  (35) 99106-6260
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>
                  Seg a Sex: 09:00 – 18:00<br />
                  Sáb: 09:00 – 12:00
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} JK Copycenter. Todos os direitos reservados.
          </p>
          <a
            href="https://noctem.agency"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visitar o site da Noctem Technology"
            className="group flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-300"
          >
            <Image
              src="/images/brand/noctem-logo.png"
              alt="Logo Noctem Technology"
              width={512}
              height={512}
              className="h-7 w-7 object-contain opacity-90 transition-opacity group-hover:opacity-100"
            />
            <span>
              Desenvolvido por <span className="font-medium text-slate-300">Noctem Technology</span>
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
