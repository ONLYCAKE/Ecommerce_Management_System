export default function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="text-center">
                    <p className="text-sm text-gray-600 font-medium">
                        Copyright © {currentYear} UDAY DAIRY EQUIPMENTS
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}
